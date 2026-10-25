import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getToken } from "@/auth/token";
import { shiftReportsApi, type ShiftReportReviewer } from "@/api/shiftReports";
import { Card, Skeleton, useToast } from "@/components/ui";
import { reportTime } from "./reportFormat";

/**
 * Agency administrators choose which supervisors may review and approve shift
 * reports. Independent of Finanzas, SmartMatch and Horas. Revoking keeps the
 * record of who authorized and who revoked (backend 126).
 */
export function ShiftReportReviewersCard({ organizationId }: { organizationId: string }) {
  const { show } = useToast();
  const [rows, setRows] = useState<ShiftReportReviewer[] | null | "error">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setRows((await shiftReportsApi.reviewers(organizationId, token)).supervisors); } catch { setRows("error"); }
  }, [organizationId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount, as the other panels
  useEffect(() => { void load(); }, [load]);

  async function toggle(r: ShiftReportReviewer) {
    const token = getToken(); if (!token) return;
    setBusy(r.membershipId);
    // Show the choice at once; the server's list (reloaded below) is the truth.
    setRows((list) => Array.isArray(list) ? list.map((x) => (x.membershipId === r.membershipId ? { ...x, authorized: !r.authorized } : x)) : list);
    try {
      if (r.authorized) await shiftReportsApi.revokeReviewer(organizationId, r.membershipId, token);
      else await shiftReportsApi.grantReviewer(organizationId, r.membershipId, token);
      show(r.authorized ? "Autorización retirada." : "Supervisor autorizado para revisar informes.", "success");
    } catch { show("No se pudo guardar el cambio.", "danger"); }
    finally { setBusy(null); await load(); }
  }

  return (
    <Card aria-label="Quién puede aprobar informes" data-testid="shift-report-reviewers">
      <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><ShieldCheck size={20} aria-hidden /> Quién puede aprobar informes</p>
      <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">Los administradores siempre pueden. Los supervisores, solo si los autorizas aquí. No da acceso a Finanzas, SmartMatch ni Horas.</p>
      {rows === null ? <Skeleton className="mt-3 h-12" />
        : rows === "error" ? <p className="mt-2 text-[var(--text-small)] text-[var(--color-danger-700)]">No se pudo cargar la lista.</p>
        : rows.length === 0 ? <p className="mt-2 text-[var(--text-small)] text-[var(--color-text-muted)]">La agencia no tiene supervisores activos.</p>
        : (
          <ul className="mt-2 flex flex-col">
            {rows.map((r) => (
              <li key={r.membershipId} className="border-b border-[var(--color-border)] last:border-b-0">
                <label className="flex min-h-11 items-center justify-between gap-3 py-1">
                  <span className="min-w-0">
                    <span className="block truncate text-[var(--text-small)] font-medium">{r.email}</span>
                    {r.authorized && r.grantedAt && <span className="block text-[var(--text-caption)] text-[var(--color-text-muted)]">Autorizado {reportTime(r.grantedAt)}{r.grantedBy ? ` por ${r.grantedBy}` : ""}</span>}
                  </span>
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--color-navy-800)]" checked={r.authorized} disabled={busy !== null}
                    data-testid={`reviewer-${r.membershipId}`} onChange={() => void toggle(r)} aria-label={`Autorizar a ${r.email}`} />
                </label>
              </li>
            ))}
          </ul>
        )}
    </Card>
  );
}
