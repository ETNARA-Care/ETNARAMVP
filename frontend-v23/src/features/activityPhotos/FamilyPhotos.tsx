import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { getToken } from "@/auth/token";
import { getActivityPhotoImage } from "@/api/activityPhotos";
import { currentLanguage } from "@/i18n";
import { formatTime } from "@/i18n/format";
import { PrivateImage } from "./PrivateImage";
import type { FamilyPhoto } from "./familyPhotos";

/** Miniatura que abre el visor. Si la imagen ya no está disponible, desaparece. */
export function FamilyPhotoThumb({ organizationId, photo, onOpen, className = "" }: {
  organizationId: string;
  photo: FamilyPhoto;
  onOpen: (id: string) => void;
  className?: string;
}) {
  const { t } = useTranslation("photos");
  const [hidden, setHidden] = useState(false);
  const load = useCallback(() => {
    const token = getToken();
    return token ? getActivityPhotoImage(organizationId, photo.id, token) : Promise.reject(new Error("NO_SESSION"));
  }, [organizationId, photo.id]);
  if (hidden) return null;
  return (
    <button type="button" onClick={() => onOpen(photo.id)} data-testid="family-photo-thumb" data-photo-id={photo.id}
      aria-label={t("family.open", { title: photo.title, time: formatTime(photo.occurredAt, currentLanguage()) })}
      className={`block overflow-hidden rounded-2xl border border-[#102b57]/10 bg-[#f8f5ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#486d48] ${className}`}>
      <PrivateImage load={load} alt={t("family.imageAlt", { title: photo.title })} unavailableLabel={t("family.unavailable")}
        className="aspect-[4/3] w-full" onUnavailable={() => setHidden(true)} />
    </button>
  );
}

/** Cuadrícula de fotos con su visor (Hoy e Historial). */
export function FamilyPhotoGrid({ organizationId, photos, onOpen }: { organizationId: string; photos: FamilyPhoto[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-testid="family-photo-grid">
      {photos.map((photo) => <FamilyPhotoThumb key={photo.id} organizationId={organizationId} photo={photo} onOpen={onOpen} />)}
    </div>
  );
}
