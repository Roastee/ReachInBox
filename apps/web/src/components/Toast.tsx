import type { ToastItem } from "../hooks/useToasts";
import { CheckIcon, XIcon, AlertIcon } from "./Icons";

interface ToastProps {
  toast: ToastItem;
  onClose: (id: number) => void;
}

function ToneIcon({ tone }: { tone: ToastItem["tone"] }) {
  if (tone === "success") return <CheckIcon size={16} />;
  if (tone === "error") return <AlertIcon size={16} />;
  return <AlertIcon size={16} />;
}

export function Toast({ toast, onClose }: ToastProps) {
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <span className="toast-icon">
        <ToneIcon tone={toast.tone} />
      </span>
      <div className="toast-copy">
        <strong>{toast.title}</strong>
        {toast.message ? <span>{toast.message}</span> : null}
      </div>
      <button type="button" className="icon-button toast-close" aria-label="Dismiss notification" onClick={() => onClose(toast.id)}>
        <XIcon size={15} />
      </button>
    </div>
  );
}

export function ToastViewport({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: number) => void }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
