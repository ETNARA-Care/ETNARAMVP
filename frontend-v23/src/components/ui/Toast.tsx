import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastTone = "success" | "warning" | "danger" | "info";
interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{ show: (message: string, tone?: ToastTone) => void } | null>(null);

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-[var(--color-success-700)]" />,
  warning: <AlertTriangle size={18} className="text-[var(--color-warning-700)]" />,
  danger: <XCircle size={18} className="text-[var(--color-danger-700)]" />,
  info: <Info size={18} className="text-[var(--color-accent-700)]" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-[calc(var(--spacing-md)+64px)] md:bottom-[var(--spacing-md)] left-1/2 -translate-x-1/2
          flex flex-col gap-2 z-[var(--z-toast)] w-[min(360px,92vw)]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="flex items-center gap-2.5 bg-[var(--color-navy-900)] text-white rounded-[var(--radius-md)]
              px-3.5 py-3 shadow-[var(--shadow-raised)] text-[var(--text-body)]"
          >
            {icons[t.tone]}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Cerrar notificación" className="opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
