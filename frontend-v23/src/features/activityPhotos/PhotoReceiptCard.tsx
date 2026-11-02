import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import type { PhotoReceipt } from "@/api/activityPhotos";
import type { ReceiptState } from "./usePhotoReceipt";
import { currentLanguage } from "@/i18n";
import { formatDate } from "@/i18n/format";

/** Tarjeta para aceptar, rechazar o cambiar la autorización. */
export function PhotoReceiptCard({ name, receipt, state, decide, onChanged }: {
  name: string;
  receipt: PhotoReceipt | null;
  state: ReceiptState;
  decide: (decision: "accepted" | "declined") => Promise<unknown>;
  onChanged?: () => void;
}) {
  const { t } = useTranslation("photos");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function choose(decision: "accepted" | "declined") {
    setBusy(true);
    setMessage(null);
    try {
      await decide(decision);
      setMessage({ ok: true, text: t("family.receipt.saved") });
      onChanged?.();
    } catch {
      setMessage({ ok: false, text: t("family.receipt.failed") });
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unavailable") return null;
  const button = "min-h-11 rounded-full px-4 text-sm font-medium disabled:opacity-60";
  const since = receipt?.decidedAt ? formatDate(receipt.decidedAt, currentLanguage(), { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="space-y-3 rounded-2xl bg-[#f8f5ee] p-4 text-sm text-[#475467]" data-testid="photo-receipt-card" data-state={state}>
      {state === "not_answered" && <>
        <p className="flex items-start gap-2 font-medium text-[#102b57]"><Camera size={18} aria-hidden className="mt-0.5 shrink-0 text-[#66845f]" />{t("family.receipt.question", { name })}</p>
        <p>{t("family.receipt.body1")}</p>
        <p>{t("family.receipt.body2")}</p>
        <p>{t("family.receipt.body3")}</p>
        <p>{t("family.receipt.body4")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void choose("accepted")} data-testid="photo-receipt-accept" className={`${button} bg-[#102b57] text-white`}>{t("family.receipt.accept")}</button>
          <button type="button" disabled={busy} onClick={() => void choose("declined")} data-testid="photo-receipt-decline" className={`${button} border border-[#102b57]/20 bg-white text-[#102b57]`}>{t("family.receipt.decline")}</button>
        </div>
      </>}
      {state === "accepted" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>{t("family.receipt.acceptedSince", { name, date: since })}</p>
          <button type="button" disabled={busy} onClick={() => void choose("declined")} data-testid="photo-receipt-stop" className={`${button} border border-[#102b57]/20 bg-white text-[#102b57]`}>{t("family.receipt.stop")}</button>
        </div>
      )}
      {state === "declined" && <>
        <p>{t("family.receipt.declinedNote", { name })}</p>
        <p>{t("family.receipt.body2")}</p>
        <button type="button" disabled={busy} onClick={() => void choose("accepted")} data-testid="photo-receipt-start" className={`${button} bg-[#102b57] text-white`}>{t("family.receipt.start")}</button>
      </>}
      {message && <p role="status" className={message.ok ? "text-[#486d48]" : "text-[#b42318]"}>{message.text}</p>}
    </div>
  );
}
