import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, BadgeCheck, ImagePlus, ShieldCheck, WifiOff, X } from "lucide-react";
import { PhotoPrepareError, preparePhoto, type PreparedPhoto } from "./preparePhoto";

/** loading → asking the server; allowed/blocked → its answer; offline → no internet, photos need it. */
export type PhotoEligibility = "loading" | "allowed" | "blocked" | "offline";

/**
 * «Foto (opcional)» dentro del registro de cuidado. Dos entradas: la cámara
 * (capture) y la galería. La foto se redibuja en el teléfono (preparePhoto) y
 * solo vive en memoria hasta que se guarda el registro. Sin conexión no se
 * ofrece: las fotos necesitan internet y no se guardan en el teléfono (E6).
 */
export function PhotoPicker({ eligibility, value, onChange, disabled }: {
  eligibility: PhotoEligibility;
  value: PreparedPhoto | null;
  onChange: (photo: PreparedPhoto | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("photos");
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<"tooLarge" | "notImage" | null>(null);
  // Vista previa solo en memoria; se libera al cambiar la foto o cerrar el registro.
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value.blob) : null), [value]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setPreparing(true);
    try {
      onChange(await preparePhoto(file));
    } catch (error) {
      setProblem(error instanceof PhotoPrepareError && error.message === "PHOTO_TOO_LARGE" ? "tooLarge" : "notImage");
    } finally {
      setPreparing(false);
      // La misma foto se puede volver a elegir después de «Quitar».
      if (cameraInput.current) cameraInput.current.value = "";
      if (galleryInput.current) galleryInput.current.value = "";
    }
  }

  const busy = disabled || preparing;
  const unavailable = eligibility === "blocked" || eligibility === "offline";
  const buttonClass = "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--text-caption)] font-medium text-[var(--color-text-primary)] transition-transform active:scale-95 disabled:opacity-40";

  return (
    <section aria-label={t("picker.section")} className="flex flex-col gap-2" data-testid="activity-photo-picker">
      <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">{t("picker.title")} <span className="font-normal text-[var(--color-text-muted)]">{t("picker.optional")}</span></p>

      {eligibility === "loading" && (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-3 py-3 text-[var(--text-small)] text-[var(--color-text-muted)]" role="status">{t("picker.checking")}</p>
      )}

      {eligibility !== "loading" && !value && (
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" disabled={busy || unavailable} aria-describedby={unavailable ? "activity-photo-unavailable" : undefined} onClick={() => cameraInput.current?.click()} className={buttonClass} data-testid="activity-photo-take">
            <Camera size={22} aria-hidden />{t("picker.takePhoto")}
          </button>
          <button type="button" disabled={busy || unavailable} aria-describedby={unavailable ? "activity-photo-unavailable" : undefined} onClick={() => galleryInput.current?.click()} className={buttonClass} data-testid="activity-photo-choose">
            <ImagePlus size={22} aria-hidden />{t("picker.chooseGallery")}
          </button>
          {/* capture abre la cámara trasera en iPhone y Android; la galería nunca lo usa. */}
          {!unavailable && <>
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" data-testid="activity-photo-camera" onChange={(event) => void choose(event.target.files?.[0])} />
            <input ref={galleryInput} type="file" accept="image/*" className="hidden" data-testid="activity-photo-gallery" onChange={(event) => void choose(event.target.files?.[0])} />
          </>}
        </div>
      )}

      {eligibility === "blocked" && (
        <p id="activity-photo-unavailable" data-testid="activity-photo-blocked" className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{t("picker.blocked")}</p>
      )}
      {eligibility === "offline" && (
        <p id="activity-photo-unavailable" data-testid="activity-photo-offline" role="status" className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] px-3 py-2.5 text-[var(--text-caption)] text-[var(--color-text-secondary)]">
          <WifiOff size={16} aria-hidden className="mt-0.5 shrink-0" />{t("picker.offline")}
        </p>
      )}

      {preparing && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]" role="status">{t("picker.preparing")}</p>}
      {problem && <p className="text-[var(--text-caption)] text-[var(--color-danger-700)]" role="alert">{t(`picker.${problem}`)}</p>}

      {value && previewUrl && (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-ivory-50)]">
          <div className="relative">
            {value.reencoded
              ? <img src={previewUrl} alt={t("picker.previewAlt")} className="block max-h-64 w-full object-cover" data-testid="activity-photo-preview" />
              : (
                // Ej. HEIC en Android: este navegador no la puede dibujar; la convierte el servidor.
                <div className="flex h-40 flex-col items-center justify-center gap-2 bg-[var(--color-ivory-100)] px-6 text-center" data-testid="activity-photo-preview">
                  <BadgeCheck size={28} aria-hidden className="text-[var(--color-sage-700)]" />
                  <p className="text-[var(--text-small)] font-medium text-[var(--color-text-primary)]">{t("picker.ready")}</p>
                  <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{t("picker.noPreview")}</p>
                </div>
              )}
            <button type="button" disabled={disabled} onClick={() => onChange(null)} aria-label={t("picker.remove")} data-testid="activity-photo-remove"
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-navy-900)]/80 text-white disabled:opacity-40">
              <X size={20} aria-hidden />
            </button>
          </div>
          <p className="flex items-start gap-2 px-3 pt-2.5 text-[var(--text-caption)] text-[var(--color-text-secondary)]">
            <ShieldCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-sage-700)]" />{t("picker.privacy")}
          </p>
          <p className="px-3 pb-2.5 pl-9 pt-1 text-[var(--text-caption)] text-[var(--color-text-muted)]">{t("picker.needsInternet")}</p>
        </div>
      )}
    </section>
  );
}
