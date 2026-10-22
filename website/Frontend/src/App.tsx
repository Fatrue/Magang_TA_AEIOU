import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { ControlPage } from "./pages/ControlPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MorePage } from "./pages/MorePage";
import { SchedulePage } from "./pages/SchedulePage";
import { SensorPage } from "./pages/SensorPage";
import { SystemPage } from "./pages/SystemPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="kontrol" element={<ControlPage />} />
          <Route path="lainnya" element={<MorePage />} />
          <Route path="lainnya/sensor" element={<SensorPage />} />
          <Route path="lainnya/jadwal" element={<SchedulePage />} />
          <Route path="lainnya/riwayat" element={<HistoryPage />} />
          <Route path="lainnya/sistem" element={<SystemPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;