import { Button } from "./Button";
import { Icon } from "./Icon";
import { useDialog } from "../hooks/useDialog";
import type { AppAlert } from "../lib/alerts";

export function NotificationsDialog({ alerts, onClose }: { alerts: AppAlert[]; onClose: () => void }) {
  const ref = useDialog(onClose);

  return (
    <div className="modal-backdrop" role="presentation">
      <div ref={ref} className="dialog notification-dialog" role="dialog" aria-modal="true" aria-labelledby="notif-title">
        <Button className="dialog-close" onClick={onClose}><Icon name="close" /><span className="sr-only">Tutup</span></Button>
        <span className="dialog-icon info"><Icon name="bell" size={27} /></span>
        <h2 id="notif-title">Notifikasi</h2>
        {alerts.length === 0 ? (
          <div className="notification-item"><i /><div><strong>Semua normal</strong><p>Tidak ada peringatan saat ini.</p></div></div>
        ) : (
          alerts.map((a) => (
            <div className="notification-item" key={a.id}><i className={a.level} /><div><strong>{a.title}</strong><p>{a.detail}</p></div></div>
          ))
        )}
        <Button className="secondary-button full" onClick={onClose}>Tutup</Button>
      </div>
    </div>
  );
}