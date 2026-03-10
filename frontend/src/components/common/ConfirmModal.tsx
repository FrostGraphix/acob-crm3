interface ConfirmModalProps {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  title,
  message,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Confirm</p>
            <h3>{title}</h3>
          </div>
        </div>
        <p className="modal-copy">{message}</p>
        <div className="modal-actions">
          <button className="button button-danger" onClick={onConfirm} type="button">
            Confirm
          </button>
          <button className="button button-ghost" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
