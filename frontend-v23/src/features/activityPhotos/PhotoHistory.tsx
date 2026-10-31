import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getToken } from "@/auth/token";
import { getAgencyPhotoHistory, type PhotoHistoryEntry } from "@/api/activityPhotos";
import { formatDate, formatTime } from "@/i18n/format";
import { currentLanguage } from "@/i18n";
import { agencyPhotoErrorKey } from "./photoErrors";

/**
 * Historial de una foto (solo lectura): quién la subió, quién la compartió, no
 * compartió o retiró, cuándo y con qué motivo. El backend lo guarda solo por
 * inserción (115): nadie lo puede editar ni borrar.
 */
export function PhotoHistory({ organizationId, photoId, version }: { organizationId: string; photoId: string; version: string }) {
  const { t } = useTranslation("photos");
  const [entries, setEntries] = useState<PhotoHistoryEntry[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const language = currentLanguage();

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    getAgencyPhotoHistory(organizationId, photoId, token)
      .then((rows) => { if (!cancelled) { setEntries(rows); setProblem(null); } })
      .catch((error) => { if (!cancelled) { const { key, code } = agencyPhotoErrorKey(error); setProblem(t(key, { code })); } });
    return () => { cancelled = true; };
  }, [organizationId, photoId, version, t]);

  if (problem) return <p className="text-[var(--text-caption)] text-[var(--color-danger-700)]" role="alert">{problem}</p>;
  if (!entries) return <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]" role="status">…</p>;
  return (
    <ol className="flex flex-col gap-2 border-l-2 border-[var(--color-border)] pl-3" data-testid="photo-history">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="text-[var(--text-caption)]">
          <p className="font-medium text-[var(--color-text-primary)]">{t(`historyAction.${entry.action}`)}</p>
          <p className="text-[var(--color-text-muted)]">
            {formatDate(entry.at, language, { day: "numeric", month: "short", year: "numeric" })}, {formatTime(entry.at, language)} · {t("historyBy", { actor: entry.actor ?? t("historySystem") })}
          </p>
          {entry.reason && <p className="text-[var(--color-text-secondary)]">{t("review.reviewedReason", { reason: entry.reason })}</p>}
        </li>
      ))}
    </ol>
  );
}
