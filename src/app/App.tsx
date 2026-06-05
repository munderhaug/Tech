import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./AppContext";
import { Layout } from "./Layout";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ArtistsPage } from "@/features/artists/ArtistsPage";
import { ArtistPage } from "@/features/artists/ArtistPage";
import { RiderIntakePage } from "@/features/artists/RiderIntakePage";
import { GapReportPage } from "@/features/gaps/GapReportPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { SchedulePage } from "@/features/schedule/SchedulePage";
import { CrewPage } from "@/features/crew/CrewPage";
import { ChatPage } from "@/features/chat/ChatPage";
import { PowerPage } from "@/features/power/PowerPage";
import { CommsPage } from "@/features/comms/CommsPage";
import { WeatherPage } from "@/features/weather/WeatherPage";
import { MorePage } from "@/features/more/MorePage";

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/artists" element={<ArtistsPage />} />
            <Route path="/artists/:showId" element={<ArtistPage />} />
            <Route path="/artists/:showId/intake" element={<RiderIntakePage />} />
            <Route path="/artists/:showId/gaps" element={<GapReportPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/crew" element={<CrewPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:channelId" element={<ChatPage />} />
            <Route path="/power" element={<PowerPage />} />
            <Route path="/comms" element={<CommsPage />} />
            <Route path="/weather" element={<WeatherPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
