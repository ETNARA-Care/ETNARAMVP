import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, FileCheck2, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { getToken } from "@/auth/token";
import { listPlatformOrganizations, type PlatformOrganization } from "@/api/platformOrganizations";
import { listPlatformCredentialQueue, listPlatformEstablishmentDocuments } from "@/api/platformCredentials";
import { Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";

export function PlatformOverviewPage() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[] | null>(null);
  const [pendingCredentials, setPendingCredentials] = useState<number | null>(null);
  const [pendingDocuments, setPendingDocuments] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setError(false);
    try {
      const [orgs, credentials, documents] = await Promise.all([
        listPlatformOrganizations(token),
        listPlatformCredentialQueue(token),
        listPlatformEstablishmentDocuments(token),
      ]);
      setOrganizations(orgs);
      setPendingCredentials(credentials.filter((item) => item.verification_status === "pending").length);
      setPendingDocuments(documents.filter((item) => item.review_status === "pending").length);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeOrganizations = useMemo(
    () => organizations?.filter((org) => org.status.toLowerCase() === "active").length ?? null,
    [organizations],
  );
  const pendingTotal = pendingCredentials === null || pendingDocuments === null ? null : pendingCredentials + pendingDocuments;

  if (error) return <ErrorState kind="network" onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-xl)] bg-[var(--color-navy-950)] px-5 py-6 text-white md:px-8 md:py-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-sage-300)]">ETNARA · Plataforma B2B</p>
            <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.02]">Centro Administrativo</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Supervisión de organizaciones cliente y de las verificaciones que requieren intervención de ETNARA.</p>
          </div>
          <Button variant="secondary" icon={<RefreshCw size={17} />} onClick={() => void load()}>Actualizar</Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Organizaciones" value={organizations?.length ?? null} icon={<Building2 size={18} />} />
        <Metric label="Activas" value={activeOrganizations} icon={<ShieldCheck size={18} />} />
        <Metric label="Credenciales pendientes" value={pendingCredentials} icon={<FileCheck2 size={18} />} />
        <Metric label="Documentos pendientes" value={pendingDocuments} icon={<FileCheck2 size={18} />} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">Clientes B2B</p><h2 className="font-display text-[var(--text-h2)]">Organizaciones</h2></div>
            <Link to="/platform/organizations" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--color-navy-900)]">Ver todas <ArrowRight size={16} /></Link>
          </div>
          {organizations === null ? <div className="p-5"><Skeleton className="h-40" /></div> : organizations.length === 0 ? <EmptyState icon={<Building2 size={30} />} title="Aún no hay organizaciones" description="Las organizaciones cliente creadas en ETNARA aparecerán aquí." /> : (
            <div className="divide-y divide-[var(--color-border)]">
              {organizations.slice(0, 6).map((org) => <div key={org.id} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="truncate font-semibold text-[var(--color-text-primary)]">{org.name}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{org.type === "agency" ? "Agencia de cuidado" : "Establecimiento residencial"}</p></div><span className="shrink-0 rounded-full bg-[var(--color-sage-100)] px-2.5 py-1 text-xs font-semibold text-[var(--color-navy-900)]">{org.status}</span></div>)}
            </div>
          )}
        </Card>

        <Card className="p-0">
          <div className="border-b border-[var(--color-border)] px-5 py-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">Operación ETNARA</p><h2 className="font-display text-[var(--text-h2)]">Requiere atención</h2></div>
          {pendingTotal === null ? <div className="p-5"><Skeleton className="h-32" /></div> : pendingTotal === 0 ? <div className="p-5"><EmptyState icon={<ShieldCheck size={30} />} title="Sin verificaciones pendientes" description="No hay documentos ni credenciales esperando revisión." /></div> : (
            <div className="space-y-3 p-5">
              {pendingDocuments! > 0 && <Attention label="Documentos de establecimientos" count={pendingDocuments!} />}
              {pendingCredentials! > 0 && <Attention label="Credenciales del personal" count={pendingCredentials!} />}
              <Link to="/platform/credentials" className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-navy-950)] px-4 text-sm font-semibold text-white">Abrir Verificación <ArrowRight size={16} /></Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number | null; icon: React.ReactNode }) {
  return <Card className="min-h-[112px] p-4 md:p-5"><div className="flex items-center justify-between gap-2 text-[var(--color-text-secondary)]"><span className="text-xs font-semibold uppercase tracking-[0.08em]">{label}</span>{icon}</div>{value === null ? <Skeleton className="mt-4 h-8 w-16" /> : <p className="mt-3 font-display text-3xl text-[var(--color-navy-950)]">{value}</p>}</Card>;
}
function Attention({ label, count }: { label: string; count: number }) {
  return <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><span className="text-sm font-medium">{label}</span><span className="rounded-full bg-[var(--color-warning-bg)] px-2.5 py-1 text-xs font-bold">{count}</span></div>;
}
