import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getToken } from "@/auth/token";
import { financeApi, type CaregiverRates } from "@/api/finance";
import { Avatar, Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { formatDate, rateWithUnit, formatCents } from "./money";

/**
 * Por cuidador: the general hourly rates of «Horas y facturación → Tarifas del
 * equipo» (backend 058, unchanged and still used to approve hours) next to the
 * per-service pay exceptions of Finanzas. Nothing is copied or deleted.
 */
export function CaregiversTab({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<CaregiverRates[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setRows((await financeApi.listCaregivers(organizationId, token)).caregivers); setFailed(false); } catch { setFailed(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  if (failed) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!rows) return <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (rows.length === 0) return <EmptyState title="Aún no hay cuidadores en el equipo" />;

  return (
    <section className="flex flex-col gap-3" aria-label="Tarifas por cuidador">
      <p className="text-sm text-[var(--color-text-secondary)]">
        La <strong>tarifa general por hora</strong> se edita en <Link className="underline" to="/agency/timesheets">Horas y facturación → Tarifas del equipo</Link> y se sigue usando para aprobar horas.
        Las <strong>excepciones por servicio</strong> se crean dentro de cada servicio y tienen prioridad para el pago de ese servicio.
      </p>
      {/* min-w-0 on the cards: a grid item otherwise grows to its longest unbroken line and pushed the
          card past the screen on iPhone (F1.1 visual). Names wrap instead of being cut. */}
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 [&>li]:min-w-0" data-caregiver-cards>
        {rows.map((c) => (
          <li key={c.membership_id} className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <Avatar name={c.display_name ?? "Cuidador"} />
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium leading-snug">{c.display_name ?? "Cuidador/a"}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{c.internal_role}</p>
              </div>
              {c.membership_status !== "active" && <Badge>Inactivo</Badge>}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm [&>div]:min-w-0">
              <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-50)] p-2.5">
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Pago general</dt>
                <dd className="font-semibold tabular-nums">{c.legacy_pay_rate_cents == null ? "Sin tarifa" : `${formatCents(c.legacy_pay_rate_cents)}/h`}</dd>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-50)] p-2.5">
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Facturación general</dt>
                <dd className="font-semibold tabular-nums">{c.legacy_bill_rate_cents == null ? "Sin tarifa" : `${formatCents(c.legacy_bill_rate_cents)}/h`}</dd>
              </div>
            </dl>
            {c.exceptions.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">Sin excepciones por servicio: se aplica la tarifa de pago de cada servicio.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {c.exceptions.map((e) => (
                  <li key={e.rateId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words">{e.serviceName}{e.dayType === "holiday" ? " · feriado" : ""}</span>
                    <span className="min-w-0 tabular-nums"><strong>{rateWithUnit(e.amountCents, e.unit)}</strong> <span className="text-xs text-[var(--color-text-muted)]">desde {formatDate(e.effectiveFrom)}{e.effectiveTo ? ` hasta ${formatDate(e.effectiveTo)}` : ""}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
