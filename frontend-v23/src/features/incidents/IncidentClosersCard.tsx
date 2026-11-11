import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { getToken } from "@/auth/token";
import { incidentClosersApi, type IncidentCloser } from "@/api/incidents";
import { Card, Skeleton, useToast } from "@/components/ui";

/**
 * 154 — Agency administrators choose which supervisors may close SERIOUS incidents (after
 * documented follow-up). Administrators always can. Revoking keeps who authorized and who revoked.
 */
export function IncidentClosersCard({ organizationId }: { organizationId: string }) {
  const { show } = useToast();
  const [rows, setRows] = useState<IncidentCloser[] | null | "error">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setRows((await incidentClosersApi.list(organizationId, token)).supervisors); } catch { setRows("error"); }
  }, [organizationId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount, as the other panels
  useEffect(() => { void load(); }, [load]);

  async function toggle(r: IncidentCloser) {
    const token = getToken(); if (!token) return;
    setBusy(r.membershipId);
    setRows((list) => Array.isArray(list) ? list.map((x) => (x.membershipId === r.membershipId ? { ...x, authorized: !r.authorized } : x)) : list);
    try {
      if (r.authorized) await incidentClosersApi.revoke(organizationId, r.membershipId, token);
      else await incidentClosersApi.grant(organizationId, r.membershipId, token);
      show(r.authorized ? "Autorización retirada." : "Supervisor autorizado para cerrar incidentes graves.", "success");
    } catch { show("No se pudo guardar el cambio.", "danger"); }
    finally { setBusy(null); await load(); }
  }

  return (
    <Card aria-label="Quién puede cerrar incidentes graves" data-testid="incident-closers">
      <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><ShieldAlert size={20} aria-hidden /> Quién puede cerrar incidentes graves</p>
      <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">Los administradores siempre pueden. Los supervisores, solo si los autorizas aquí. Siempre se exige seguimiento documentado antes de cerrar.</p>
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
                    {r.authorized && r.grantedAt && <span className="block text-[var(--text-caption)] text-[var(--color-text-muted)]">Autorizado {new Date(r.grantedAt).toLocaleDateString("es-PR", { day: "numeric", month: "short", year: "numeric" })}{r.grantedBy ? ` por ${r.grantedBy}` : ""}</span>}
                  </span>
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--color-navy-800)]" checked={r.authorized} disabled={busy !== null}
                    data-testid={`incident-closer-${r.membershipId}`} onChange={() => void toggle(r)} aria-label={`Autorizar a ${r.email} a cerrar incidentes graves`} />
                </label>
              </li>
            ))}
          </ul>
        )}
    </Card>
  );
}
