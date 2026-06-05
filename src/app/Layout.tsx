import { NavLink, Outlet } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { MoreHorizontal, WifiOff } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { useApp } from "./AppContext";
import { getStore } from "@/data/store";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/primitives";

function StageSelector() {
  const { festivalId, stageId, setStageId } = useApp();
  const stages = useLiveQuery(
    async () => (festivalId ? getStore().stagesForFestival(festivalId) : []),
    [festivalId],
  );
  return (
    <Select
      value={stageId ?? ""}
      onChange={(e) => setStageId(e.target.value || null)}
      className="h-9 w-auto min-w-[9rem]"
    >
      <option value="">All stages</option>
      {(stages ?? []).map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}

function TopBar() {
  const { user, online } = useApp();
  const festival = useLiveQuery(async () => (await getStore().festivals.all())[0], []);
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{festival?.name ?? "StageOps"}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.name} · {user.role.replaceAll("_", " ").toLowerCase()}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!online && (
            <span className="flex items-center gap-1 rounded-full bg-pending/20 px-2 py-1 text-xs text-pending">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
          <StageSelector />
        </div>
      </div>
    </header>
  );
}

function DesktopSidebar() {
  return (
    <nav className="hidden w-56 shrink-0 border-r border-border md:block">
      <div className="sticky top-[57px] flex flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function MobileBottomNav() {
  const primary = NAV_ITEMS.filter((i) => i.primary).slice(0, 4);
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden">
      {primary.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px]",
              isActive ? "text-primary" : "text-muted-foreground",
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
      <NavLink
        to="/more"
        className={({ isActive }) =>
          cn(
            "flex flex-col items-center gap-0.5 py-2 text-[10px]",
            isActive ? "text-primary" : "text-muted-foreground",
          )
        }
      >
        <MoreHorizontal className="h-5 w-5" />
        More
      </NavLink>
    </nav>
  );
}

export function Layout() {
  return (
    <div className="min-h-full">
      <TopBar />
      <div className="mx-auto flex max-w-5xl">
        <DesktopSidebar />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:pb-8">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
