import { Button } from "./Button";
import { Icon } from "./Icon";
import { useDialog } from "../hooks/useDialog";

export function ConfirmDialog({ title, message, confirmLabel, tone = "danger", busy = false, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Fokus awal sengaja di "Batal", bukan tombol merah: Enter refleks tidak langsung menghentikan penyiraman.
  const ref = useDialog(onCancel, ".secondary-button");

  return (
    <div className="modal-backdrop" role="presentation">
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <span className="dialog-icon"><Icon name="alert" size={27} /></span>
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <Button className="secondary-button" onClick={onCancel} disabled={busy}>Batal</Button>
          <Button className={tone === "danger" ? "danger-button" : "primary-button dialog-primary"} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}