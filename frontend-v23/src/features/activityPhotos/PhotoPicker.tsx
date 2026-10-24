import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, BadgeCheck, ImagePlus, ShieldCheck, X } from "lucide-react";
import { PhotoPrepareError, preparePhoto, type PreparedPhoto } from "./preparePhoto";

export type PhotoEligibility = "loading" | "allowed" | "blocked";

/**
 * «Añadir foto (opcional)» inside the care-record sheet. Two entry points:
 * the camera (capture) and the gallery. The chosen photo is redrawn on the
 * phone (preparePhoto) and only kept in memory until the record is saved.
 */
export function PhotoPicker({ eligibility, value, onChange, disabled }: {
  eligibility: PhotoEligibility;
  value: PreparedPhoto | null;
  onChange: (photo: PreparedPhoto | null) => void;
  disabled?: boolean;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // In-memory preview only; released as soon as the photo changes or the sheet closes.
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value.blob) : null), [value]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setPreparing(true);
    try {
      onChange(await preparePhoto(file));
    } catch (error) {
      setProblem(error instanceof PhotoPrepareError && error.message === "PHOTO_TOO_LARGE"
        ? "La foto es demasiado grande. Prueba con otra."
        : "Ese archivo no es una foto. Prueba con otra.");
    } finally {
      setPreparing(false);
      // The same photo can be chosen again after «Quitar».
      if (cameraInput.current) cameraInput.current.value = "";
      if (galleryInput.current) galleryInput.current.value = "";
    }
  }

  const busy = disabled || preparing;
  const blocked = eligibility === "blocked";

  return (
    <section aria-label="Foto de la actividad" className="flex flex-col gap-2" data-testid="activity-photo-picker">
      <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">Foto <span className="font-normal text-[var(--color-text-muted)]">(opcional)</span></p>

      {eligibility === "loading" && (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-3 py-3 text-[var(--text-small)] text-[var(--color-text-muted)]">Comprobando si se pueden añadir fotos…</p>
      )}

      {eligibility !== "loading" && !value && (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busy || blocked}
            aria-describedby={blocked ? "activity-photo-blocked" : undefined}
            onClick={() => cameraInput.current?.click()}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--text-caption)] font-medium text-[var(--color-text-primary)] transition-transform active:scale-95 disabled:opacity-40"
          >
            <Camera size={22} aria-hidden />Tomar foto
          </button>
          <button
            type="button"
            disabled={busy || blocked}
            aria-describedby={blocked ? "activity-photo-blocked" : undefined}
            onClick={() => galleryInput.current?.click()}
            className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--text-caption)] font-medium text-[var(--color-text-primary)] transition-transform active:scale-95 disabled:opacity-40"
          >
            <ImagePlus size={22} aria-hidden />Elegir de la galería
          </button>
          {/* capture opens the rear camera on iPhone and Android; the gallery input never sets it. */}
          {!blocked && <>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" data-testid="activity-photo-camera" onChange={(event) => void choose(event.target.files?.[0])} />
          <input ref={galleryInput} type="file" accept="image/*" className="hidden" data-testid="activity-photo-gallery" onChange={(event) => void choose(event.target.files?.[0])} />
          </>}
        </div>
      )}

      {blocked && (
        <p id="activity-photo-blocked" data-testid="activity-photo-blocked" className="text-[var(--text-caption)] text-[var(--color-text-muted)]">
          No se pueden añadir fotos para esta persona. Puedes guardar el registro sin foto.
        </p>
      )}

      {preparing && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]" role="status">Preparando foto…</p>}
      {problem && <p className="text-[var(--text-caption)] text-[var(--color-danger-700)]" role="alert">{problem}</p>}

      {eligibility === "allowed" && value && previewUrl && (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-ivory-50)]">
          <div className="relative">
            {value.reencoded
              ? <img src={previewUrl} alt="Vista previa de la foto" className="block max-h-64 w-full object-cover" data-testid="activity-photo-preview" />
              : (
                // e.g. HEIC on Android: this browser cannot draw it, the server converts it.
                <div className="flex h-40 flex-col items-center justify-center gap-2 bg-[var(--color-ivory-100)] px-6 text-center" data-testid="activity-photo-preview">
                  <BadgeCheck size={28} aria-hidden className="text-[var(--color-sage-700)]" />
                  <p className="text-[var(--text-small)] font-medium text-[var(--color-text-primary)]">Foto lista</p>
                  <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Este teléfono no puede mostrar la vista previa. Se convertirá al enviarla.</p>
                </div>
              )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              aria-label="Quitar foto"
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-navy-900)]/80 text-white disabled:opacity-40"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
          <p className="flex items-start gap-2 px-3 py-2.5 text-[var(--text-caption)] text-[var(--color-text-secondary)]">
            <ShieldCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-sage-700)]" />
            Se quitan la ubicación y los datos de la cámara. La agencia la revisará antes de compartirla con la familia.
          </p>
        </div>
      )}
    </section>
  );
}
