import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  listOrgCareRecipients,
  getShiftCoverage,
  listOrgWorkers,
  listOrgShifts,
  type OrgCareRecipient,
  type CoverageSummary,
  type OrgShift,
  type OrgWorkerMembership,
} from "../../api/agency";
import { listIncidents, type Incident } from "../../api/incidents";
import { listMyNotifications } from "../../api/notifications";
import { LoadingState, ErrorState } from "../../components/UiStates";
import { Card, Avatar } from "../../components/Primitives";
import { Badge } from "../../components/Badge";
import { ChevronRightIcon, AlertIcon } from "../../components/icons";

// ── helpers ────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function orgTypeLabel(type: string) {
  if (type === "RESIDENTIAL_CARE_HOME") return "Hogar de cuidado residencial";
  if (type === "HOME_CARE_AGENCY") return "Agencia de cuidado a domicilio";
  return type;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });
}

function shiftStatusBadge(status: string) {
  if (status === "scheduled") return <Badge tone="neutral" size="sm">Programado</Badge>;
  if (status === "active" || status === "in_progress") return <Badge tone="active" size="sm">En curso</Badge>;
  if (status === "completed") return <Badge tone="verified" size="sm">Completado</Badge>;
  if (status === "unassigned" || status === "open") return <Badge tone="warning" size="sm">Sin cubrir</Badge>;
  if (status === "cancelled") return <Badge tone="critical" size="sm">Cancelado</Badge>;
  return <Badge tone="neutral" size="sm">{status}</Badge>;
}

function recipientStatusBadge(status: string) {
  if (status === "active") return <Badge tone="active" size="sm">Cuidado activo</Badge>;
  if (status === "inactive") return <Badge tone="neutral" size="sm">Inactivo</Badge>;
  return <Badge tone="neutral" size="sm">{status}</Badge>;
}

function recipientInitials(r: OrgCareRecipient) {
  const first = (r.preferred_name ?? r.first_name)[0] ?? "";
  const last = r.last_name[0] ?? "";
  return (first + last).toUpperCase();
}

const AVATAR_COLORS = ["#e7cf9f", "#bcd4c7", "#e3c2b8", "#c4d0e3", "#d4c4e3"];

// ── sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
  empty,
}: {
  label: string;
  value: string | number;
  tone?: "warning" | "critical" | "verified";
  empty?: boolean;
}) {
  const colors: Record<string, string> = {
    warning: "var(--color-warning)",
    critical: "var(--color-critical)",
    verified: "var(--color-verified)",
  };
  const bgs: Record<string, string> = {
    warning: "var(--color-warning-bg)",
    critical: "var(--color-critical-bg)",
    verified: "var(--color-verified-bg)",
  };
  return (
    <div
      style={{
        background: tone ? bgs[tone] : "var(--color-surface)",
        border: `1px solid ${tone ? colors[tone] + "44" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-card)",
        padding: "var(--space-4) var(--space-5)",
        flex: "1 1 140px",
        minWidth: 120,
        opacity: empty ? 0.6 : 1,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 28,
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          color: tone ? colors[tone] : "var(--color-ink)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      <p
        style={{
          margin: "2px 0 0",
          fontSize: "var(--fs-caption)",
          color: tone ? colors[tone] : "var(--color-ink-soft)",
        }}
      >
        {label}
      </p>
    </div>
  );
}

function SectionHeader({ title, to, toLabel }: { title: string; to?: string; toLabel?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: "var(--space-3)",
        marginTop: "var(--space-6)",
      }}
    >
      <h2 style={{ fontSize: "var(--fs-title)", margin: 0 }}>{title}</h2>
      {to && (
        <Link
          to={to}
          style={{
            fontSize: "var(--fs-caption)",
            color: "var(--color-ink-soft)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {toLabel ?? "Ver todo"} <ChevronRightIcon size={14} />
        </Link>
      )}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export function AgencyDashboardRealPage() {
  const { activeOrganization, user } = useAuth();
  const navigate = useNavigate();

  const [recipients, setRecipients] = useState<OrgCareRecipient[] | null>(null);
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);
  const [workers, setWorkers] = useState<OrgWorkerMembership[] | null>(null);
  const [shifts, setShifts] = useState<OrgShift[] | null>(null);
  const [openIncidents, setOpenIncidents] = useState<Incident[] | null>(null);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const organizationId = activeOrganization?.id;

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);

    Promise.all([
      listOrgCareRecipients(organizationId),
      getShiftCoverage(organizationId),
      listOrgWorkers(organizationId),
      listOrgShifts(organizationId, { dateFrom: today }),
      listIncidents(organizationId, { status: "open" }),
      listMyNotifications(),
    ])
      .then(([recipientsRes, coverageRes, workersRes, shiftsRes, incidentsRes, notifsRes]) => {
        if (cancelled) return;
        setRecipients(recipientsRes);
        setCoverage(coverageRes);
        setWorkers(workersRes);
        setShifts(shiftsRes);
        setOpenIncidents(incidentsRes);
        setUnreadCount(notifsRes.items.filter((n) => !n.readAt).length);
      })
      .catch(() => !cancelled && setError("No pudimos cargar la información del panel."))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [organizationId]);

  if (!organizationId) return <LoadingState />;
  if (loading) return <LoadingState label="Cargando panel..." />;
  if (error) return <ErrorState description={error} />;

  const isResidential = activeOrganization.type === "RESIDENTIAL_CARE_HOME";
  const activeRecipients = recipients?.filter((r) => r.status === "active") ?? [];
  const activeWorkers = workers?.filter((w) => w.status === "active") ?? [];
  const uncoveredShifts = shifts?.filter((s) => s.status === "unassigned" || s.status === "open") ?? [];
  const upcomingShifts = (shifts ?? []).slice(0, 3);
  const openIncidentCount = openIncidents?.length ?? 0;

  // Alertas — combinadas de datos reales disponibles
  const alerts: string[] = [];
  if (uncoveredShifts.length > 0) alerts.push(`${uncoveredShifts.length} turno${uncoveredShifts.length > 1 ? "s" : ""} requiere${uncoveredShifts.length > 1 ? "n" : ""} cobertura`);
  if (openIncidentCount > 0) alerts.push(`${openIncidentCount} incidente${openIncidentCount > 1 ? "s" : ""} abierto${openIncidentCount > 1 ? "s" : ""} pendiente${openIncidentCount > 1 ? "s" : ""} de revisión`);
  if (unreadCount && unreadCount > 0) alerts.push(`${unreadCount} notificación${unreadCount > 1 ? "es" : ""} sin leer`);

  return (
    <div style={{ padding: "var(--space-6) var(--space-6) var(--space-8)", maxWidth: 960, margin: "0 auto" }}>

      {/* ── ENCABEZADO ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--fs-display-lg)", margin: "0 0 2px" }}>{greeting()}</h1>
          <p style={{ margin: "2px 0 0", color: "var(--color-ink-soft)" }}>
            {activeOrganization.name}
            {user?.email ? ` · ${user.email}` : ""}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            {orgTypeLabel(activeOrganization.type)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            to="/messages"
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              background: "var(--color-ink-tint)",
              color: "var(--color-ink)",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: "var(--fs-caption)",
            }}
          >
            Mensajes
          </Link>
          <Link
            to="/notifications"
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              background: unreadCount ? "var(--color-warning-bg)" : "var(--color-ink-tint)",
              color: unreadCount ? "var(--color-warning)" : "var(--color-ink)",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: "var(--fs-caption)",
            }}
          >
            Notificaciones{unreadCount ? ` (${unreadCount})` : ""}
          </Link>
        </div>
      </div>

      {/* ── MÉTRICAS — 6 tarjetas como el prototipo ────────────────────────── */}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", margin: "var(--space-5) 0" }}>
        <StatCard
          label={isResidential ? "Residentes activos" : "Pacientes activos"}
          value={activeRecipients.length}
        />
        <StatCard
          label="Personal de turno"
          value={activeWorkers.length}
        />
        <StatCard
          label={isResidential ? "Cobertura de turnos" : "Visitas de hoy"}
          value={coverage ? `${coverage.covered}/${coverage.total}` : "—"}
        />
        <StatCard
          label="Profesionales verificados"
          value="—"
          empty
        />
        <StatCard
          label="Credenciales por vencer"
          value="—"
          empty
        />
        <StatCard
          label="Incidentes abiertos"
          value={openIncidents !== null ? openIncidentCount : "—"}
          tone={openIncidentCount > 0 ? "critical" : undefined}
        />
      </div>

      {/* ── SECCIÓN "AHORA" ────────────────────────────────────────────────── */}
      <SectionHeader title="Ahora" to="/agency/personas" toLabel="Ver personas" />

      {activeRecipients.length === 0 && (
        <div
          style={{
            background: "var(--color-surface-muted)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-6)",
            textAlign: "center",
            color: "var(--color-ink-soft)",
            fontSize: "var(--fs-body)",
          }}
        >
          Todavía no hay personas registradas.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
        {activeRecipients.slice(0, 6).map((r, idx) => (
          <Card
            key={r.id}
            onClick={() => navigate(`/agency/personas/${r.id}`)}
            style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
          >
            <Avatar
              initials={recipientInitials(r)}
              color={AVATAR_COLORS[idx % AVATAR_COLORS.length]}
              size={40}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {r.preferred_name ?? r.first_name} {r.last_name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                {r.room_id ? `Habitación ${r.room_id}` : isResidential ? "Sin habitación asignada" : "Visita a domicilio"}
              </p>
            </div>
            {recipientStatusBadge(r.status)}
            <ChevronRightIcon size={16} color="var(--color-ink-soft)" />
          </Card>
        ))}
      </div>

      {/* ── ALERTAS ────────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <>
          <h2 style={{ fontSize: "var(--fs-title)", marginBottom: "var(--space-3)" }}>Alertas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
            {alerts.map((a) => (
              <div
                key={a}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--color-warning-bg)",
                  color: "var(--color-warning)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-3) var(--space-4)",
                }}
              >
                <AlertIcon size={16} />
                <span style={{ fontSize: "var(--fs-body)" }}>{a}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TURNOS PRÓXIMOS ────────────────────────────────────────────────── */}
      <SectionHeader title="Turnos próximos" to="/agency/turnos" toLabel="Ver todos los turnos" />

      {upcomingShifts.length === 0 && (
        <div
          style={{
            background: "var(--color-surface-muted)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-6)",
            textAlign: "center",
            color: "var(--color-ink-soft)",
            marginBottom: "var(--space-6)",
          }}
        >
          No hay turnos próximos registrados.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
        {upcomingShifts.map((shift) => (
          <Card key={shift.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {formatDate(shift.scheduled_start)}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                {formatTime(shift.scheduled_start)} – {formatTime(shift.scheduled_end)}
                {shift.care_recipient_id ? ` · Persona #${shift.care_recipient_id.slice(-6)}` : ""}
              </p>
            </div>
            {shiftStatusBadge(shift.status)}
          </Card>
        ))}
      </div>

      {/* ── NOTA OPERATIVA (solo si hay algo para aclarar) ─────────────────── */}
      <div
        style={{
          background: "var(--color-surface-muted)",
          border: "1px dashed var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-5)",
          fontSize: "var(--fs-caption)",
          color: "var(--color-ink-soft)",
        }}
      >
        Profesionales verificados y credenciales por vencer requieren endpoints backend aún no disponibles. Incidentes abiertos y turnos son funcionales.
      </div>

      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3) var(--space-5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--color-ink)" }}>Centro de cumplimiento</p>
          <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
            Mantuvimos este espacio visible, pero sin navegar a una pantalla demo hasta que existan datos reales de verificación y credenciales.
          </p>
        </div>
        <ChevronRightIcon size={16} color="var(--color-ink-soft)" />
      </div>
    </div>
  );
}
