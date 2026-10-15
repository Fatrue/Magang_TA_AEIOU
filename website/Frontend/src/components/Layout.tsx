import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { Navigation } from "./Navigation";
import { NotificationsDialog } from "./NotificationsDialog";
import { useIrrigation } from "../context/IrrigationContext";

export function Layout() {
  const { status, alerts, error } = useIrrigation();
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <Navigation online={status.online} />
      <div className="main-shell">
        <AppHeader online={status.online} alertCount={alerts.length} onNotify={() => setOpen(true)} />
        {error && <div className="banner warn page-banner">{error}. Data di layar mungkin sudah usang.</div>}
        <Outlet />
      </div>
      {open && <NotificationsDialog alerts={alerts} onClose={() => setOpen(false)} />}
    </div>
  );
}