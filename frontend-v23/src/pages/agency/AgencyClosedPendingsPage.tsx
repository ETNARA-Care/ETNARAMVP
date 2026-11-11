import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, History, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  CLOSURE_OUTCOME_LABELS,
  CLOSURE_REASON_LABELS,
  listShiftClosures,
  type ShiftClosureHistoryItem,
} from "@/api/shiftClosures";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";

const day = (v: string) => new Date(v).toLocaleString("es-PR", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * 154 — History of pending items the agency closed from «Requiere atención»: shifts closed without
 * service (who, when, reason, note). Resolved incidents live in Incidentes › Resueltos. Nothing here
 * can be edited or deleted.
 */
export function AgencyClosedPendingsPage() {
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [rows, setRows] = useState<ShiftClosureHistoryItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try { setRows(await listShiftClosures(organizationId, token)); } catch { setRows([]); setError(true); }
  }, [organizationId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount, as the other pages
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate("/agency/operations")} className="self-start">Centro operacional</Button>
      <PageHeader title="Pendientes cerrados" description="Turnos terminados sin servicio que la agencia cerró, con motivo, nota, responsable y fecha. No se pueden editar ni borrar." />
      <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[var(--text-small)] text-[var(--color-text-secondary)]"><ShieldCheck size={18} aria-hidden /> Los incidentes resueltos están en Incidentes › Resueltos.</p>
        <Button variant="secondary" onClick={() => navigate("/agency/incidents?tab=resolved")}>Ver incidentes resueltos</Button>
      </Card>
      {rows === null ? <div className="flex flex-col gap-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        : error ? <ErrorState kind="server" onRetry={() => void load()} />
        : rows.length === 0 ? <EmptyState icon={<History size={28} />} title="Aún no hay turnos cerrados sin servicio." />
        : (
          <ul className="flex flex-col gap-2" data-testid="closed-shifts">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" className="w-full text-left" onClick={() => navigate(`/agency/shifts/${r.shiftId}`)}>
                  <Card className="flex flex-col gap-2 hover:bg-[var(--color-ivory-100)] transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-[var(--color-text-primary)]">{r.recipientName ?? "Residente"}</p>
                      <Badge tone="neutral">{CLOSURE_OUTCOME_LABELS[r.outcome]}</Badge>
                    </div>
                    <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Turno: {day(r.scheduledStart)}</p>
                    <p className="text-[var(--text-small)] text-[var(--color-text-primary)]">{CLOSURE_REASON_LABELS[r.reasonCode]}</p>
                    <p className="line-clamp-3 whitespace-pre-wrap break-words text-[var(--text-small)] text-[var(--color-text-secondary)]">{r.note}</p>
                    <p className="break-words text-[var(--text-caption)] text-[var(--color-text-muted)]">Cerrado por {r.closedByEmail ?? "—"} · {day(r.closedAt)}</p>
                    {r.contradicted && <p className="flex items-center gap-1.5 text-[var(--text-caption)] text-[var(--color-danger-700)]"><AlertTriangle size={14} aria-hidden /> Llegó después un registro de entrada real: revisar horas.</p>}
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
