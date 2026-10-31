import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui";
import { getToken } from "@/auth/token";
import { getActivityPhotoImage, type ActivityPhotoRef } from "@/api/activityPhotos";

const TONE = { pending: "warning", approved: "success", rejected: "neutral", withdrawn: "neutral" } as const;

/**
 * Su propia foto de una actividad: llega por la API como Blob privado (nunca un
 * enlace al almacenamiento) y se libera cuando la tarjeta sale de la pantalla.
 */
export function ActivityPhotoThumb({ organizationId, photo, title }: { organizationId: string; photo: ActivityPhotoRef; title: string }) {
  const { t } = useTranslation("photos");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

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

  return (
    <figure className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]" data-testid="activity-photo-thumb">
      <div className="flex aspect-[4/3] items-center justify-center bg-[var(--color-ivory-100)]">
        {url
          ? <img src={url} alt={t("caregiver.photoOf", { title })} className="h-full w-full object-cover" />
          : failed
            ? <ImageOff size={22} aria-label={t("caregiver.unavailable")} className="text-[var(--color-text-muted)]" />
            : <span className="h-full w-full animate-pulse bg-[var(--color-ivory-200)]" aria-label={t("caregiver.loading")} />}
      </div>
      <figcaption className="flex flex-col gap-1 p-2">
        <span className="truncate text-[var(--text-caption)] font-medium text-[var(--color-text-primary)]">{title}</span>
        <span><Badge tone={TONE[photo.status]}>{t(`status.${photo.status}`)}</Badge></span>
      </figcaption>
    </figure>
  );
}
