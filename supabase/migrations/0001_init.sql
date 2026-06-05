-- StageOps initial schema.
-- This is the SOURCE OF TRUTH for the data model. The TypeScript app (src/domain/types.ts)
-- mirrors these shapes, and the v1 build runs against a local IndexedDB store with the same
-- shape; when PowerSync is wired, local SQLite syncs to these Postgres tables.
--
-- Offline-writable tables carry client_uuid for sync dedupe/idempotency, plus created_at /
-- updated_at. RLS policies are stubbed (commented) — auth is wired later (house-crew only).

-- ---- Enums ---------------------------------------------------------------
create type requirement_category as enum (
  'SOUND_FOH', 'SOUND_MON', 'SOUND_INPUTS', 'LIGHTING', 'AV',
  'BACKLINE', 'STAGING', 'POWER', 'CREW_CALL', 'OTHER'
);
create type requirement_status as enum ('MET', 'GAP', 'OVER_SPEC', 'UNMATCHED');
create type resolution_type as enum (
  'SUBSTITUTED', 'WONT_PROVIDE', 'PENDING', 'CROSS_RENTAL_ORDERED', 'CLARIFICATION_NEEDED'
);
create type crew_role as enum (
  'TECH_PRODUCTION_MANAGER', 'STAGE_MANAGER', 'SOUND_ENGINEER', 'MONITOR_ENGINEER',
  'AV_ENGINEER', 'LIGHTING_ENGINEER', 'CREW_CHIEF'
);
create type department as enum ('SOUND', 'LIGHTS', 'AV', 'STAGE', 'POWER', 'GENERAL');
create type chat_scope as enum ('STAGE', 'ARTIST', 'DEPARTMENT', 'ALL');
create type weather_status as enum ('GO', 'HOLD', 'STOP');
create type rider_file_type as enum ('PDF', 'WORD', 'IMAGE', 'TEXT');
create type schedule_block_type as enum (
  'LOAD_IN', 'SOUNDCHECK', 'LINECHECK', 'SET', 'CHANGEOVER', 'CURFEW', 'OTHER'
);

-- ---- Core domain ---------------------------------------------------------
create table festival (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null
);

create table stage (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festival(id) on delete cascade,
  name text not null,
  is_outdoor boolean not null default false
);

create table artist_show (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stage(id) on delete cascade,
  festival_id uuid not null references festival(id) on delete cascade,
  artist_name text not null,
  date date not null,
  set_start timestamptz,
  set_end timestamptz,
  changeover_after_min int,
  advancing_tm_contact text,            -- internal only; no artist access
  client_uuid uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rider_file (
  id uuid primary key default gen_random_uuid(),
  artist_show_id uuid not null references artist_show(id) on delete cascade,
  storage_path text,                    -- null when pasted text
  type rider_file_type not null,
  raw_text text,                        -- extracted/pasted text used for extraction
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  client_uuid uuid not null
);

create table requirement_item (
  id uuid primary key default gen_random_uuid(),
  artist_show_id uuid not null references artist_show(id) on delete cascade,
  rider_file_id uuid references rider_file(id) on delete set null,
  category requirement_category not null,
  description text not null,            -- raw text as parsed
  normalized_json jsonb not null default '{}',
  confidence real not null default 0,   -- 0..1
  source_ref text,
  status requirement_status not null default 'UNMATCHED',
  matched_inventory_id uuid,            -- soft ref to inventory_item
  created_by_ai boolean not null default false,
  client_uuid uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inventory_item (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festival(id) on delete cascade,
  stage_id uuid references stage(id) on delete set null,  -- null = shared / cross-rental pool
  category requirement_category not null,
  make text not null,
  model text not null,
  qty int not null default 1,
  power_draw_w int not null default 0,
  spec_json jsonb not null default '{}',
  client_uuid uuid not null
);

create table assignment (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_item(id) on delete cascade,
  stage_id uuid not null references stage(id) on delete cascade,
  artist_show_id uuid references artist_show(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  client_uuid uuid not null
);
-- Resource-conflict detection queries this table for overlapping windows per inventory_item.
create index assignment_item_idx on assignment(inventory_item_id);

-- A gap can never be silently cleared: a resolution requires a non-empty note,
-- and records who + when. (Mirrored by gapEngine.buildGapResolution in the app.)
create table gap_resolution (
  id uuid primary key default gen_random_uuid(),
  requirement_item_id uuid not null references requirement_item(id) on delete cascade,
  resolution_type resolution_type not null,
  note text not null check (length(trim(note)) > 0),
  resolved_by text not null,
  resolved_at timestamptz not null default now(),
  client_uuid uuid not null
);

create table remember_note (
  id uuid primary key default gen_random_uuid(),
  artist_show_id uuid not null references artist_show(id) on delete cascade,
  body text not null,
  author text not null,
  created_at timestamptz not null default now(),
  client_uuid uuid not null
);

create table post_show_note (
  id uuid primary key default gen_random_uuid(),
  artist_show_id uuid not null references artist_show(id) on delete cascade,
  body text not null,
  author text not null,
  created_at timestamptz not null default now(),
  client_uuid uuid not null
);

create table attachment (
  id uuid primary key default gen_random_uuid(),
  artist_show_id uuid not null references artist_show(id) on delete cascade,
  name text not null,
  kind text not null,
  storage_path text,
  created_at timestamptz not null default now(),
  client_uuid uuid not null
);

-- ---- Crew & time ---------------------------------------------------------
create table crew_member (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festival(id) on delete cascade,
  name text not null,
  role crew_role not null,
  department department not null
);

create table shift (
  id uuid primary key default gen_random_uuid(),
  crew_member_id uuid not null references crew_member(id) on delete cascade,
  stage_id uuid not null references stage(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  call_time timestamptz not null,
  break_log_json jsonb not null default '[]',
  client_uuid uuid not null
);

-- ---- Schedule ------------------------------------------------------------
-- Soundcheck windows may be per-artist OR shared stage blocks (open question for the human):
-- artist_show_id nullable supports both. Default usage is per-artist.
create table schedule_block (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stage(id) on delete cascade,
  date date not null,
  type schedule_block_type not null,
  label text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  artist_show_id uuid references artist_show(id) on delete cascade,
  client_uuid uuid not null
);

-- ---- Chat ----------------------------------------------------------------
create table chat_channel (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festival(id) on delete cascade,
  scope chat_scope not null,
  ref_id text,                          -- stage_id / artist_show_id / department; null for ALL
  name text not null
);

create table chat_message (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references chat_channel(id) on delete cascade,
  author_id text not null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  client_uuid uuid not null             -- dedupe on sync
);
create unique index chat_message_client_uuid_idx on chat_message(client_uuid);

-- ---- Power / comms / weather --------------------------------------------
create table power_distro (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stage(id) on delete cascade,
  name text not null,
  capacity_w int not null
);

create table comms_channel (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid not null references festival(id) on delete cascade,
  rf_channel text not null,
  assigned_to text not null,
  department department not null
);

create table weather_status_row (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stage(id) on delete cascade,
  status weather_status not null default 'GO',
  note text not null default '',
  updated_by text not null,
  updated_at timestamptz not null default now()
);

-- ---- Row Level Security (wire-later, house-crew only) --------------------
-- Auth is not live in v1. When Supabase auth is connected, enable RLS per table and
-- scope reads to a crew member's assigned stage(s); department roles get write priority
-- on their department's line items, but ANY house user may resolve a gap (resolved_by
-- records who). Example shape, left disabled for now:
--
-- alter table requirement_item enable row level security;
-- create policy "house crew read on assigned stage" on requirement_item
--   for select using ( auth.uid() in (select crew on the show's stage) );
