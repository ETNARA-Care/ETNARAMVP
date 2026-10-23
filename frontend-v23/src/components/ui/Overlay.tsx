import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button";

interface OverlayBaseProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Usa <dialog> nativo: focus trap, Esc-to-close y el backdrop ::backdrop
 * vienen gratis del navegador -- menos JS propio para algo tan sensible a
 * accesibilidad como un modal.
 */
export function Modal({ open, onClose, title, children, footer }: OverlayBaseProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(480px,92vw)] max-h-[calc(100dvh-2rem)] rounded-[var(--radius-lg)] p-0 border-none
        shadow-[var(--shadow-raised)] backdrop:bg-[var(--color-navy-950)]/40
        open:flex open:flex-col open:animate-[fadeIn_var(--duration-base)_var(--ease-standard)]"
    >
      {/* Header and footer stay visible; only the body scrolls (tall forms on a phone). */}
      <div className="flex shrink-0 items-start justify-between gap-3 px-[var(--spacing-md)] py-[var(--spacing-sm)] border-b border-[var(--color-border)]">
        <h2 className="min-w-0 break-words pt-1.5 font-display text-[1.2rem] leading-tight sm:text-[var(--text-h3)]">{title}</h2>
        <span className="shrink-0"><IconButton icon={<X size={18} />} label="Cerrar" onClick={onClose} /></span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-[var(--spacing-md)]">{children}</div>
      {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] px-[var(--spacing-md)] pt-[var(--spacing-sm)] pb-[max(var(--spacing-md),env(safe-area-inset-bottom))]">{footer}</div>}
    </dialog>
  );
}

/**
 * Patrón móvil principal para registrar cuidados durante un turno activo:
 * el cuidador no pierde el contexto de la pantalla de fondo, y el sheet es
 * alcanzable con el pulgar en uso a una mano.
 */
export function BottomSheet({ open, onClose, title, children, footer }: OverlayBaseProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-0 mt-auto mb-0 w-full max-w-full rounded-t-[var(--radius-lg)] rounded-b-none p-0 border-none
        shadow-[var(--shadow-sheet)] backdrop:bg-[var(--color-navy-950)]/40 max-h-[85vh]"
    >
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-[var(--color-ivory-200)]" aria-hidden />
      <div className="flex items-center justify-between px-[var(--spacing-md)] py-[var(--spacing-sm)]">
        <h2 className="font-display text-[var(--text-h3)]">{title}</h2>
        <IconButton icon={<X size={18} />} label="Cerrar" onClick={onClose} />
      </div>
      <div className="px-[var(--spacing-md)] pb-[var(--spacing-md)] overflow-y-auto">{children}</div>
      {footer && (
        <div className="sticky bottom-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] p-[var(--spacing-md)] pb-[max(var(--spacing-md),env(safe-area-inset-bottom))] flex gap-2">
          {footer}
        </div>
      )}
    </dialog>
  );
}
