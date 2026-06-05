-- Demo seed for the Postgres backend — mirrors src/data/seed.ts.
-- Rigged to exercise every flag: a quantity-short GAP, an OVER_SPEC, an UNMATCHED,
-- a resource conflict (shared SD12 across overlapping shows), a tight changeover, and a
-- power overdraw on the main stage. Run after 0001_init.sql.

begin;

insert into festival (id, name, start_date, end_date) values
  ('00000000-0000-0000-0000-0000000f0001', 'Fjordfest 2026', '2026-06-19', '2026-06-21');

insert into stage (id, festival_id, name, is_outdoor) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000f0001', 'Main Stage', true),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-0000000f0001', 'Club Tent', false);

insert into artist_show (id, stage_id, festival_id, artist_name, date, set_start, set_end, changeover_after_min, advancing_tm_contact, client_uuid) values
  ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000f0001', 'Aurora Sound', '2026-06-20', '2026-06-20T20:00:00+02', '2026-06-20T21:00:00+02', 45, 'tm@aurorasound.example (internal only)', gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000b0002', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000f0001', 'Glacier Drop', '2026-06-20', '2026-06-20T21:20:00+02', '2026-06-20T22:30:00+02', 30, null, gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000b0003', '00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-0000000f0001', 'Midnight Sun', '2026-06-20', '2026-06-20T20:30:00+02', '2026-06-20T21:30:00+02', 30, null, gen_random_uuid());

-- Inventory: SD12 in the shared pool (stage_id null); K2 over-spec; SM58 short.
insert into inventory_item (id, festival_id, stage_id, category, make, model, qty, power_draw_w, spec_json, client_uuid) values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000f0001', null, 'SOUND_FOH', 'DiGiCo', 'SD12', 1, 250, '{"model":"SD12"}', gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-0000000a0001', 'SOUND_FOH', 'L-Acoustics', 'K2', 16, 1000, '{"model":"K2"}', gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-0000000a0001', 'SOUND_INPUTS', 'Shure', 'SM58', 8, 0, '{"model":"SM58"}', gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000c0004', '00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-0000000a0001', 'SOUND_MON', 'd&b', 'M4', 8, 400, '{"model":"M4"}', gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000c0005', '00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-0000000a0001', 'LIGHTING', 'Robe', 'MegaPointe', 16, 670, '{"model":"MegaPointe"}', gen_random_uuid());

-- Aurora requirements (matched live by the gap engine; statuses left default UNMATCHED).
insert into requirement_item (artist_show_id, category, description, normalized_json, confidence, source_ref, created_by_ai, client_uuid) values
  ('00000000-0000-0000-0000-0000000b0001', 'SOUND_FOH', '1x DiGiCo SD12 at front of house', '{"qty":1,"make":"DiGiCo","model":"SD12"}', 0.93, 'FOH / line 3', true, gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000b0001', 'SOUND_FOH', '12x L-Acoustics K2 main hangs', '{"qty":12,"make":"L-Acoustics","model":"K2"}', 0.90, 'FOH / line 4', true, gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000b0001', 'SOUND_INPUTS', '12x Shure SM58 vocal mics', '{"qty":12,"make":"Shure","model":"SM58"}', 0.88, 'INPUTS / line 6', true, gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000b0001', 'SOUND_INPUTS', '4x DI boxes for keys/tracks', '{"qty":4}', 0.55, 'INPUTS / line 7', true, gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000b0001', 'SOUND_MON', '6x d&b M4 wedges', '{"qty":6,"make":"d&b","model":"M4"}', 0.89, 'MONITORS / line 9', true, gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000b0001', 'LIGHTING', '8x moving head wash fixtures', '{"qty":8}', 0.70, 'LIGHTING / line 11', true, gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000b0001', 'BACKLINE', '1x Yamaha grand piano (acoustic)', '{"qty":1,"make":"Yamaha"}', 0.60, 'BACKLINE / line 13', true, gen_random_uuid());

-- The same SD12 double-booked across overlapping windows → resource conflict.
insert into assignment (inventory_item_id, stage_id, artist_show_id, start_time, end_time, client_uuid) values
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-0000000b0001', '2026-06-20T19:00:00+02', '2026-06-20T21:15:00+02', gen_random_uuid()),
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-0000000b0003', '2026-06-20T20:00:00+02', '2026-06-20T21:45:00+02', gen_random_uuid());

-- Power distros: main-stage draw (≈29.9 kW) exceeds 24 kW → overdraw.
insert into power_distro (stage_id, name, capacity_w) values
  ('00000000-0000-0000-0000-0000000a0001', 'Main Stage Distro A', 24000),
  ('00000000-0000-0000-0000-0000000a0002', 'Tent Distro', 16000);

-- Comms: CH2 reused by Sound and Lights → clash.
insert into comms_channel (festival_id, rf_channel, assigned_to, department) values
  ('00000000-0000-0000-0000-0000000f0001', 'CH1', 'Stage Managers', 'STAGE'),
  ('00000000-0000-0000-0000-0000000f0001', 'CH2', 'Sound', 'SOUND'),
  ('00000000-0000-0000-0000-0000000f0001', 'CH2', 'Lights', 'LIGHTS');

insert into weather_status_row (stage_id, status, note, updated_by) values
  ('00000000-0000-0000-0000-0000000a0001', 'GO', 'Clear, light wind.', 'Seed Crew');

insert into chat_channel (festival_id, scope, ref_id, name) values
  ('00000000-0000-0000-0000-0000000f0001', 'ALL', null, 'All-House'),
  ('00000000-0000-0000-0000-0000000f0001', 'STAGE', '00000000-0000-0000-0000-0000000a0001', 'Main Stage'),
  ('00000000-0000-0000-0000-0000000f0001', 'DEPARTMENT', 'SOUND', 'Sound Dept'),
  ('00000000-0000-0000-0000-0000000f0001', 'ARTIST', '00000000-0000-0000-0000-0000000b0001', 'Aurora Sound');

insert into crew_member (festival_id, name, role, department) values
  ('00000000-0000-0000-0000-0000000f0001', 'Ingrid Holm', 'TECH_PRODUCTION_MANAGER', 'GENERAL'),
  ('00000000-0000-0000-0000-0000000f0001', 'Lars Vik', 'SOUND_ENGINEER', 'SOUND'),
  ('00000000-0000-0000-0000-0000000f0001', 'Sofie Aas', 'STAGE_MANAGER', 'STAGE');

commit;
