import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui";
import { FamilyPhotoViewer } from "./FamilyPhotoViewer";
import { stillShared, type FamilyPhoto } from "./familyPhotos";

/**
 * Visor compartido por una pantalla del Portal Familiar. Si la foto abierta deja
 * de estar en la lista (la agencia la retiró o cambió el consentimiento y la
 * pantalla se actualizó), el visor se cierra en el acto y se avisa.
 */
export function useFamilyPhotoViewer(organizationId: string | undefined, photos: FamilyPhoto[]): { open: (id: string) => void; viewer: ReactNode } {
  const { t } = useTranslation("photos");
  const { show } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const gone = openId !== null && !stillShared(photos, openId);

  useEffect(() => {
    if (!gone) return;
    void Promise.resolve().then(() => { setOpenId(null); show(t("family.gone"), "warning"); });
  }, [gone, show, t]);

  const open = useCallback((id: string) => setOpenId(id), []);
  // Sin foto compartida no se dibuja nada, ni un instante.
  const viewer = organizationId && openId && !gone
    ? <FamilyPhotoViewer organizationId={organizationId} photos={photos} photoId={openId} onChange={setOpenId} onClose={() => setOpenId(null)} />
    : null;
  return { open, viewer };
}
