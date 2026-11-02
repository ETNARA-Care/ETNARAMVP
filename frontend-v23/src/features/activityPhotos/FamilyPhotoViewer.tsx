import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { getToken } from "@/auth/token";
import { getActivityPhotoImage } from "@/api/activityPhotos";
import { currentLanguage } from "@/i18n";
import { formatDate, formatTime } from "@/i18n/format";
import { clampZoom, neighbour, pinchDistance, type FamilyPhoto } from "./familyPhotos";
import { markViewerOpen } from "./familyRefresh";

/**
 * Visor a pantalla completa (Portal Familiar, E3). La imagen se pide de nuevo
 * cada vez que se abre (nunca de una copia guardada), así que una foto retirada
 * o con el consentimiento revocado ya no se muestra. No hay botón de descarga.
 * Ampliar: doble toque o pellizco; con la foto sin ampliar, deslizar cambia de foto.
 */
export function FamilyPhotoViewer({ organizationId, photos, photoId, onChange, onClose }: {
  organizationId: string;
  photos: FamilyPhoto[];
  photoId: string;
  onChange: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("photos");
  const language = currentLanguage();
  const photo = photos.find((item) => item.id === photoId) ?? null;
  const index = photos.findIndex((item) => item.id === photoId);
  const [state, setState] = useState<{ id: string; url: string | null; gone: boolean }>({ id: photoId, url: null, gone: false });
  const [zoom, setZoom] = useState(1);
  const closeButton = useRef<HTMLButtonElement>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);

  // Imagen fresca, privada (Authorization en cabecera, no-store); se libera al cambiar o cerrar.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    getActivityPhotoImage(organizationId, photoId, token)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ id: photoId, url: objectUrl, gone: false });
      })
      .catch(() => { if (!cancelled) setState({ id: photoId, url: null, gone: true }); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [organizationId, photoId]);
  const current = state.id === photoId ? state : { id: photoId, url: null, gone: false };

  const go = useCallback((step: 1 | -1) => {
    const next = neighbour(photos, photoId, step);
    if (next) { setZoom(1); onChange(next); }
  }, [photos, photoId, onChange]);

  // Mientras el visor está abierto, la pantalla comprueba cada 10 s si la foto sigue compartida.
  useEffect(() => markViewerOpen(), []);

  // Teclado, foco y página quieta detrás del visor.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [onClose, go]);

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      pinch.current = { distance: pinchDistance(event.touches[0], event.touches[1]), zoom };
      swipe.current = null;
    } else if (event.touches.length === 1) {
      swipe.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
  }
  function onTouchMove(event: TouchEvent) {
    if (event.touches.length === 2 && pinch.current) {
      setZoom(clampZoom(pinch.current.zoom * (pinchDistance(event.touches[0], event.touches[1]) / pinch.current.distance)));
    }
  }
  function onTouchEnd(event: TouchEvent) {
    if (pinch.current && event.touches.length < 2) { pinch.current = null; return; }
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
    // Doble toque: ampliar/reducir.
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const now = Date.now();
      if (now - lastTap.current < 300) { setZoom((z) => (z > 1 ? 1 : 2.5)); lastTap.current = 0; } else lastTap.current = now;
      return;
    }
    if (zoom === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }

  const when = photo ? `${formatDate(photo.occurredAt, language, { weekday: "long", day: "numeric", month: "long" })} · ${formatTime(photo.occurredAt, language)}` : "";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("family.viewer")} data-testid="family-photo-viewer"
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-[#0b1426] text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-sm text-white/70" aria-live="polite">{photos.length > 1 && index >= 0 ? t("family.position", { current: index + 1, total: photos.length }) : ""}</span>
        <button ref={closeButton} type="button" onClick={onClose} aria-label={t("family.close")} data-testid="family-photo-close"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white">
          <X size={22} aria-hidden />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto" data-testid="family-photo-stage" data-zoom={zoom}
        style={{ touchAction: zoom > 1 ? "pan-x pan-y" : "pan-y" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}>
        {current.url && (
          <div className="flex min-h-full items-center justify-center" style={{ width: `${zoom * 100}%` }}>
            <img src={current.url} alt={photo ? t("family.imageAlt", { title: photo.title }) : ""} data-testid="family-photo-full" draggable={false}
              onContextMenu={(event) => event.preventDefault()}
              className="max-h-full w-full select-none object-contain" style={{ WebkitTouchCallout: "none", maxHeight: zoom > 1 ? "none" : undefined }} />
          </div>
        )}
        {!current.url && !current.gone && <p className="grid h-full place-items-center text-sm text-white/70" role="status">{t("family.loading")}</p>}
        {current.gone && (
          <div className="grid h-full place-items-center px-8 text-center" data-testid="family-photo-gone">
            <div className="flex flex-col items-center gap-3"><ImageOff size={30} aria-hidden className="text-white/60" /><p>{t("family.gone")}</p></div>
          </div>
        )}
        {photos.length > 1 && <>
          <button type="button" onClick={() => go(-1)} disabled={index <= 0} aria-label={t("family.previous")} data-testid="family-photo-prev"
            className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 disabled:opacity-0">
            <ChevronLeft size={24} aria-hidden />
          </button>
          <button type="button" onClick={() => go(1)} disabled={index >= photos.length - 1} aria-label={t("family.next")} data-testid="family-photo-next"
            className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 disabled:opacity-0">
            <ChevronRight size={24} aria-hidden />
          </button>
        </>}
      </div>

      {photo && (
        <div className="space-y-1 px-5 pb-4 pt-3" data-testid="family-photo-caption">
          <p className="font-medium">{photo.title}</p>
          {photo.summary && <p className="text-sm text-white/80">{photo.summary}</p>}
          <p className="text-xs text-white/60">{when}{photo.caregiverName ? ` · ${t("family.by", { name: photo.caregiverName })}` : ""}</p>
          {photo.availableUntil && <p className="text-xs text-white/60" data-testid="family-viewer-available-until">{t("family.availableUntil", { date: formatDate(photo.availableUntil, currentLanguage(), { day: "numeric", month: "long" }) })}</p>}
          <p className="text-xs text-white/40">{t("family.zoomHint")}</p>
        </div>
      )}
    </div>,
    document.body,
  );
}
