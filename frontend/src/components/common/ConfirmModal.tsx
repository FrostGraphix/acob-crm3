import { useEffect } from "react";

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
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-card modal-card--compact">
        <div className="modal-header">
          <div className="modal-header-info">
            <span className="modal-eyebrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Confirm
            </span>
            <h3 className="modal-title">{title}</h3>
          </div>
          <button className="modal-close" onClick={onCancel} type="button" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-confirm-message">{message}</p>
        </div>

        <div className="modal-footer">
          <button className="modal-btn modal-btn--ghost" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="modal-btn modal-btn--danger" onClick={onConfirm} type="button">
            Confirm
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
