import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { getToken } from "@/auth/token";
import { listPhotoRecipients, type PhotoRecipient } from "@/api/activityPhotos";
import { Badge, Card } from "@/components/ui";
import { currentLanguage } from "@/i18n";
import { formatDate } from "@/i18n/format";

/**
 * Agencia (V3/V4): qué familiares de este residente reciben fotos. Solo lectura:
 * cada familiar decide desde su portal (empieza en «No»). La agencia no puede
 * aceptar en su nombre.
 */
export function PhotoRecipientsCard({ organizationId, careRecipientId }: { organizationId: string; careRecipientId: string }) {
  const { t } = useTranslation("photos");
  const [rows, setRows] = useState<PhotoRecipient[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    listPhotoRecipients(organizationId, careRecipientId, token)
      .then((value) => { if (!cancelled) { setRows(value); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [organizationId, careRecipientId]);

  const day = (value: string) => formatDate(value, currentLanguage(), { day: "numeric", month: "short", year: "numeric" });
  return (
    <Card className="flex flex-col gap-3" data-testid="photo-recipients-card">
      <div className="flex items-center gap-2">
        <Users size={18} aria-hidden className="text-[var(--color-text-secondary)]" />
        <h2 className="font-medium text-[var(--color-text-primary)]">{t("recipients.title")}</h2>
      </div>
      <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{t("recipients.description")}</p>
      {failed && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("recipients.loadFailed")}</p>}
      {!failed && rows?.length === 0 && <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">{t("recipients.none")}</p>}
      {!failed && rows && rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-border)]">
          {rows.map((row) => (
            <li key={row.relationshipId} className="flex items-center justify-between gap-3 py-2" data-testid="photo-recipient" data-receipt={row.receipt} data-receives={row.receives ? "true" : "false"}>
              <span className="min-w-0 truncate text-[var(--text-small)] text-[var(--color-text-primary)]">{row.email}</span>
              {!row.allowedByAgency
                ? <Badge tone="neutral">{t("recipients.blocked")}</Badge>
                : row.receipt === "accepted" && row.decidedAt
                  ? <Badge tone="success">{t("recipients.accepted", { date: day(row.decidedAt) })}</Badge>
                  : <Badge tone="neutral">{t(row.receipt === "declined" ? "recipients.declined" : "recipients.notAnswered")}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
