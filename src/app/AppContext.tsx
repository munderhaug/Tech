// App-wide context: the "who am I / where am I" state.
//
// In v1 there is no live auth (house-crew-only auth is wired later with Supabase). We model
// the current user + role here so role-aware affordances and `resolved_by` capture work today.
// Stage/festival selection drives every scoped view.

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getStore } from "@/data/store";
import type { CrewRole } from "@/domain/types";

export interface CurrentUser {
  id: string;
  name: string;
  role: CrewRole;
}

interface AppState {
  festivalId: string | null;
  stageId: string | null; // null = "all stages"
  user: CurrentUser;
  online: boolean;
  setStageId: (id: string | null) => void;
  setUser: (u: CurrentUser) => void;
}

const DEFAULT_USER: CurrentUser = {
  id: "crew-tpm",
  name: "Ingrid Holm",
  role: "TECH_PRODUCTION_MANAGER",
};

const Ctx = React.createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [stageId, setStageId] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<CurrentUser>(DEFAULT_USER);
  const [online, setOnline] = React.useState<boolean>(navigator.onLine);

  // First festival in the store is the active one (single-festival v1).
  const festivalId = useLiveQuery(async () => {
    const fests = await getStore().festivals.all();
    return fests[0]?.id ?? null;
  }, []);

  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const value: AppState = {
    festivalId: festivalId ?? null,
    stageId,
    user,
    online,
    setStageId,
    setUser,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
