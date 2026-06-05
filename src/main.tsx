import React from "react";
import ReactDOM from "react-dom/client";
import { LocalDataStore } from "@/data/local/localStore";
import { setDataStore } from "@/data/store";
import { seedIfEmpty } from "@/data/seed";
import { App } from "@/app/App";
import "./index.css";

// Wire the local (offline) data store and load demo data before first render.
// Swapping to PowerSync later means replacing these two lines with a PowerSyncDataStore.
setDataStore(new LocalDataStore());

async function bootstrap() {
  await seedIfEmpty();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
