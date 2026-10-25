import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
/** «Cerrar» / «Close» in the active language. */
function CloseButton({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("common");
  return <IconButton icon={<X size={18} />} label={t("actions.close")} onClick={onClose} />;
}

function keepFocusedFieldVisible(event: React.FocusEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement;
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  window.setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
}

/**
 * iOS Safari: the keyboard shrinks the *visual* viewport but not 100dvh, so a
 * full-screen sheet keeps its footer behind the keyboard. Follow the visual
 * viewport while open (phones only) so header, body and buttons stay above it.
 */
function useVisualViewportBox(active: boolean) {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) { setBox(null); return; }
    const update = () => {
      // Only when something (the keyboard) actually covers the layout viewport.
      setBox(window.innerWidth < 640 && vv.height < window.innerHeight - 1 ? { height: Math.round(vv.height), top: Math.round(vv.offsetTop) } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, [active]);
  return box;
}

/**
 * Usa <dialog> nativo: focus trap, Esc-to-close y el backdrop ::backdrop
 * vienen gratis del navegador -- menos JS propio para algo tan sensible a
 * accesibilidad como un modal.
 */
export function Modal({ open, onClose, title, children, footer, fullScreenOnMobile = false, sheetOnMobile = false, eyebrow, wide = false }: OverlayBaseProps & {
  /** Long forms (addresses, map): full screen on phones, centered card from 640 px. */
  fullScreenOnMobile?: boolean;
  /** Phones: bottom sheet (full width, up to 92% of the screen, thumb-reachable full-width
   *  buttons, safe-area aware). From 640 px it is the usual centered card. */
  sheetOnMobile?: boolean;
  /** Small label above the title (e.g. «Resumen de la organización»). */
  eyebrow?: string;
  /** Centered card up to 640 px instead of 480 px (desktop/tablet). */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const keyboardBox = useVisualViewportBox(open && fullScreenOnMobile);

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
      data-keyboard-open={keyboardBox ? "true" : undefined}
      style={keyboardBox ? { height: keyboardBox.height, maxHeight: keyboardBox.height, top: keyboardBox.top, bottom: "auto" } : undefined}
      className={`p-0 border-none shadow-[var(--shadow-raised)] backdrop:bg-[var(--color-navy-950)]/40
        open:flex open:flex-col open:animate-[fadeIn_var(--duration-base)_var(--ease-standard)]
        ${fullScreenOnMobile
          ? "m-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(560px,92vw)] sm:rounded-[var(--radius-lg)]"
          : sheetOnMobile
            ? `mx-0 mt-auto mb-0 w-full max-w-none max-h-[92dvh] rounded-t-[1.5rem] rounded-b-none sm:m-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[var(--radius-lg)] ${wide ? "sm:w-[min(640px,92vw)]" : "sm:w-[min(480px,92vw)]"}`
            : `m-auto ${wide ? "w-[min(640px,92vw)]" : "w-[min(480px,92vw)]"} max-h-[calc(100dvh-2rem)] rounded-[var(--radius-lg)]`}`}
      data-variant={sheetOnMobile ? "sheet" : fullScreenOnMobile ? "fullscreen" : "card"}
    >
      {/* Header and footer stay visible; only the body scrolls (tall forms on a phone).
          They sit above the body's stacking context so nothing inside it (e.g. the
          map's own z-index layers on iOS Safari) can paint over the buttons. */}
      {sheetOnMobile && <div className="relative z-10 flex shrink-0 justify-center bg-[var(--color-surface,#fff)] pt-2 sm:hidden" aria-hidden><span className="h-1.5 w-10 rounded-full bg-[var(--color-ivory-200)]" /></div>}
      <div className={`relative z-10 flex shrink-0 items-start justify-between gap-3 bg-[var(--color-surface,#fff)] border-b border-[var(--color-border)] ${sheetOnMobile ? "px-5 pb-3 pt-2 sm:px-[var(--spacing-md)] sm:py-[var(--spacing-sm)]" : "px-[var(--spacing-md)] py-[var(--spacing-sm)] pt-[max(var(--spacing-sm),env(safe-area-inset-top))]"}`}>
        <div className="min-w-0 pt-1.5">
          {eyebrow && <p className="mb-1 text-[length:var(--text-caption)] font-semibold uppercase tracking-[.14em] text-[var(--color-text-muted)]">{eyebrow}</p>}
          <h2 className={`min-w-0 break-words font-display leading-tight ${sheetOnMobile ? "line-clamp-2 text-[length:1.125rem] sm:line-clamp-none sm:text-[length:var(--text-h3)]" : "text-[1.2rem] sm:text-[var(--text-h3)]"}`}>{title}</h2>
        </div>
        <span className="shrink-0"><CloseButton onClose={onClose} /></span>
      </div>
      {/* `flex-auto` (not flex-1): Safari collapses a 0% flex-basis inside a column
          that only has a max-height, which cut the body off on iPhone. */}
      <div onFocus={keepFocusedFieldVisible}
        className={`relative isolate z-0 min-h-0 flex-auto overflow-y-auto overscroll-contain pb-8 [scroll-padding-bottom:6rem] [-webkit-overflow-scrolling:touch] ${sheetOnMobile ? "px-4 pt-4 sm:p-[var(--spacing-md)] sm:pb-8" : "p-[var(--spacing-md)]"}`}>{children}</div>
      {footer && <div className={`relative z-10 flex shrink-0 justify-end gap-2 bg-[var(--color-surface,#fff)] border-t border-[var(--color-border)] pt-[var(--spacing-sm)] pb-[max(var(--spacing-md),env(safe-area-inset-bottom))] ${sheetOnMobile ? "px-4 [&>*]:flex-1 sm:px-[var(--spacing-md)] sm:[&>*]:flex-none" : "px-[var(--spacing-md)]"}`}>{footer}</div>}
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
        <CloseButton onClose={onClose} />
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
