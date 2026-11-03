import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageOff } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { getToken } from "@/auth/token";
import { deleteActivityPhoto, getActivityPhotoImage, type ActivityPhotoRef } from "@/api/activityPhotos";
import { photoErrorKey } from "./photoErrors";

/**
 * Su propia foto de una actividad (v2): llega por la API como Blob privado (nunca un
 * enlace al almacenamiento) y se libera al salir. Solo existe durante su visita
 * (el servidor la deja de servir al cerrar la visita + 1 h): no hay galería propia.
 * Mientras tanto puede quitarla (se elimina para todos).
 */
export function ActivityPhotoThumb({ organizationId, photo, title, onRemoved, onError }: {
  organizationId: string;
  photo: ActivityPhotoRef;
  title: string;
  onRemoved?: (photoId: string) => void;
  onError?: (message: string) => void;
}) {
  const { t } = useTranslation("photos");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    getActivityPhotoImage(organizationId, photo.id, token)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [organizationId, photo.id]);

  async function remove() {
    const token = getToken();
    if (!token) return;
    setRemoving(true);
    try {
      await deleteActivityPhoto(organizationId, photo.id, token);
      onRemoved?.(photo.id);
    } catch (error) {
      const { key, code } = photoErrorKey(error);
      onError?.(t("caregiver.removeFailed", { reason: t(key, { code }) }));
      setConfirming(false);
    } finally {
      setRemoving(false);
    }
  }

  const shared = photo.status === "approved";
  return (
    <figure className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]" data-testid="activity-photo-thumb" data-photo-id={photo.id}>
      <div className="flex aspect-[4/3] items-center justify-center bg-[var(--color-ivory-100)]">
        {url
          ? <img src={url} alt={t("caregiver.photoOf", { title })} className="h-full w-full object-cover" draggable={false} />
          : failed
            ? <ImageOff size={22} aria-label={t("caregiver.unavailable")} className="text-[var(--color-text-muted)]" />
            : <span className="h-full w-full animate-pulse bg-[var(--color-ivory-200)]" aria-label={t("caregiver.loading")} />}
      </div>
      <figcaption className="flex flex-col gap-1.5 p-2">
        <span className="truncate text-[var(--text-caption)] font-medium text-[var(--color-text-primary)]">{title}</span>
        <span data-testid="activity-photo-state" data-shared={shared ? "true" : "false"}><Badge tone={shared ? "success" : "neutral"}>{t(shared ? "status.approved" : "status.pending")}</Badge></span>
        {/* D1: si la agencia la conserva no se ofrece quitarla (el backend también lo impide); nunca el motivo. */}
        {photo.keptByAgency && <span className="text-[var(--text-caption)] text-[var(--color-text-secondary)]" data-testid="activity-photo-kept">{t("caregiver.kept")}</span>}
        {photo.canRemove !== false && !photo.keptByAgency && onRemoved && (
          confirming ? (
            <div className="flex flex-col gap-1.5" data-testid="activity-photo-remove-confirm">
              <span className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{t("caregiver.removeConfirm")}</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" disabled={removing} onClick={() => setConfirming(false)}>{t("caregiver.removeNo")}</Button>
                <Button size="sm" variant="danger" loading={removing} onClick={() => void remove()} data-testid="activity-photo-remove-yes">{t("caregiver.removeYes")}</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)} data-testid="activity-photo-remove">{t("caregiver.remove")}</Button>
          )
        )}
      </figcaption>
    </figure>
  );
}
