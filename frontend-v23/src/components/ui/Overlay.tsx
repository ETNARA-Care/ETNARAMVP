import { useEffect, useRef, type ReactNode } from "react";
import type React from "react";
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
 * iPhone keyboards cover the lower half of the screen without resizing the
 * layout: bring the focused field to the middle of the scrollable body.
 */
function keepFocusedFieldVisible(event: React.FocusEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement;
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  window.setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
}

/**
 * Usa <dialog> nativo: focus trap, Esc-to-close y el backdrop ::backdrop
 * vienen gratis del navegador -- menos JS propio para algo tan sensible a
 * accesibilidad como un modal.
 */
export function Modal({ open, onClose, title, children, footer, fullScreenOnMobile = false }: OverlayBaseProps & {
  /** Long forms (addresses, map): full screen on phones, centered card from 640 px. */
  fullScreenOnMobile?: boolean;
}) {
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
      className={`p-0 border-none shadow-[var(--shadow-raised)] backdrop:bg-[var(--color-navy-950)]/40
        open:flex open:flex-col open:animate-[fadeIn_var(--duration-base)_var(--ease-standard)]
        ${fullScreenOnMobile
          ? "m-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(560px,92vw)] sm:rounded-[var(--radius-lg)]"
          : "m-auto w-[min(480px,92vw)] max-h-[calc(100dvh-2rem)] rounded-[var(--radius-lg)]"}`}
    >
      {/* Header and footer stay visible; only the body scrolls (tall forms on a phone).
          They sit above the body's stacking context so nothing inside it (e.g. the
          map's own z-index layers on iOS Safari) can paint over the buttons. */}
      <div className="relative z-10 flex shrink-0 items-start justify-between gap-3 bg-[var(--color-surface,#fff)] px-[var(--spacing-md)] py-[var(--spacing-sm)] pt-[max(var(--spacing-sm),env(safe-area-inset-top))] border-b border-[var(--color-border)]">
        <h2 className="min-w-0 break-words pt-1.5 font-display text-[1.2rem] leading-tight sm:text-[var(--text-h3)]">{title}</h2>
        <span className="shrink-0"><IconButton icon={<X size={18} />} label="Cerrar" onClick={onClose} /></span>
      </div>
      <div onFocus={keepFocusedFieldVisible}
        className="relative isolate z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain p-[var(--spacing-md)] pb-8 [scroll-padding-bottom:6rem] [-webkit-overflow-scrolling:touch]">{children}</div>
      {footer && <div className="relative z-10 flex shrink-0 justify-end gap-2 bg-[var(--color-surface,#fff)] border-t border-[var(--color-border)] px-[var(--spacing-md)] pt-[var(--spacing-sm)] pb-[max(var(--spacing-md),env(safe-area-inset-bottom))]">{footer}</div>}
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
