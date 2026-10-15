import { Button } from "./Button";
import { Icon } from "./Icon";

export function AppHeader({ onNotify, online, alertCount }: { onNotify: () => void; online: boolean; alertCount: number }) {
  return (
    <header className="app-header">
      <div className="brand-mark"><Icon name="leaf" size={24} /></div>
      <div className="brand-copy">
        <h1>Irigasi BRMP</h1>
        <span className={`online ${online ? "" : "is-down"}`}><i /> {online ? "Sistem Online" : "Sistem Offline"}</span>
      </div>
      <Button className="icon-button notification-button" onClick={onNotify}>
        <Icon name="bell" />
        {alertCount > 0 && <span className="notification-dot" />}
        <span className="sr-only">Notifikasi ({alertCount})</span>
      </Button>
    </header>
  );
}