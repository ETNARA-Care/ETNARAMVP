import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/auth/token";
import { getPhotoReceipt, setPhotoReceipt, type PhotoReceipt } from "@/api/activityPhotos";

export type ReceiptState = PhotoReceipt["decision"] | "loading" | "unavailable";

/**
 * Autorización individual del familiar (V3). Empieza en «No» (not_answered) y
 * no es retroactiva: el backend solo comparte las fotos enviadas DESPUÉS de
 * aceptar. Mientras no haya aceptado, la página no pide ninguna imagen.
 * `unavailable` = el backend no tiene el recibo (sin relación o función apagada).
 */
export function usePhotoReceipt(organizationId: string | undefined, careRecipientId: string | undefined, enabled: boolean) {
  const [receipt, setReceipt] = useState<PhotoReceipt | null>(null);
  const [state, setState] = useState<ReceiptState>("loading");

  const load = useCallback(async () => {
    const token = getToken();
    if (!enabled || !organizationId || !careRecipientId || !token) { setState("unavailable"); return; }
    try {
      const value = await getPhotoReceipt(organizationId, careRecipientId, token);
      setReceipt(value);
      setState(value ? value.decision : "unavailable");
    } catch {
      setState("unavailable");
    }
  }, [organizationId, careRecipientId, enabled]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const decide = useCallback(async (decision: "accepted" | "declined") => {
    const token = getToken();
    if (!organizationId || !careRecipientId || !token) throw new Error("NO_SESSION");
    const value = await setPhotoReceipt(organizationId, careRecipientId, decision, token);
    setReceipt(value);
    setState(value.decision);
    return value;
  }, [organizationId, careRecipientId]);

  return { receipt, state, decide, accepted: state === "accepted" };
}

