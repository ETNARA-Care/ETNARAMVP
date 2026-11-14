import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSignature } from "lucide-react";
import { getToken } from "@/auth/token";
import { contractsApi, type CentralContractsOverview } from "@/api/contracts";
import type { ApiError } from "@/api/client";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { acceptanceLabel, contractDate } from "@/features/contracts/contractFormat";

type Filter = "all" | "pending" | "accepted";

/**
 * ETNARA Central — consulta del estado contractual de cada agencia (Etapa 2). Solo lectura:
 * pendiente o aceptado, versión, fecha y representante que firmó. Central no acepta por nadie
 * y aquí no hay ningún botón para hacerlo.
 */
export function PlatformContractsPage() {
  const [data, setData] = useState<CentralContractsOverview | null | "error" | "unavailable">(null);
  const [filter, setFilter] = useState<Filter>("all");
  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setData(null);
    try { setData(await contractsApi.centralOverview(token)); }
    catch (e) { setData((e as ApiError).status === 404 ? "unavailable" : "error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    if (!data || typeof data === "string") return [];
    return data.organizations.flatMap((o) => o.contracts.map((c) => ({ org: o, c, doc: data.documents.find((d) => d.versionId === c.versionId)! })));
  }, [data]);
  const shown = rows.filter((r) => filter === "all" || (filter === "pending" ? r.c.state === "pending" : r.c.state !== "pending"));
  const pending = rows.filter((r) => r.c.state === "pending").length;

  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-md)]">
      <header>
        <h1 className="font-display text-[length:1.75rem] leading-tight text-[var(--color-text-primary)] md:text-[length:2rem]">Contratos de las agencias</h1>
        <p className="mt-2 max-w-3xl text-[var(--text-small)] text-[var(--color-text-secondary)]">Consulta de solo lectura: qué agencias aceptaron cada documento vigente, qué versión, cuándo y quién firmó. ETNARA no acepta en nombre de ninguna agencia.</p>
      </header>
      {data === null ? <Skeleton className="h-48" />
        : data === "error" ? <ErrorState kind="server" onRetry={() => void load()} />
        : data === "unavailable" ? <EmptyState icon={<FileSignature size={28} />} title="Módulo contractual apagado" description="Las rutas de contratos no están activas en este servidor." />
        : data.documents.length === 0 ? <EmptyState icon={<FileSignature size={28} />} title="No hay documentos vigentes" description="Cuando se publique una versión aparecerá el estado de cada agencia." />
        : <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar">
            {([["all", `Todas (${rows.length})`], ["pending", `Pendientes (${pending})`], ["accepted", `Aceptadas (${rows.length - pending})`]] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} data-testid={`filter-${k}`}
                className={`min-h-11 rounded-full border px-4 text-[var(--text-small)] font-medium ${filter === k ? "border-[var(--color-navy-900)] bg-[var(--color-navy-900)] text-white" : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]"}`}>{label}</button>
            ))}
          </div>
          <div className="flex flex-col gap-2" data-testid="central-contracts">
            {shown.map(({ org, c, doc }) => {
              const st = acceptanceLabel(c.state);
              return (
                <Card key={`${org.organizationId}-${c.versionId}`} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4" data-testid="central-contract-row" data-state={c.state}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{org.name}</p>
                    <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{doc.title} · versión vigente {doc.versionLabel}{doc.isTest ? " · prueba" : ""}</p>
                  </div>
                  <div className="min-w-0 text-[var(--text-small)] text-[var(--color-text-secondary)] sm:w-80">
                    {c.accepted
                      ? <>{c.state === "accepted" ? "" : "Última aceptación: "}versión {c.accepted.versionLabel} · {contractDate(c.accepted.acceptedAt)}<br />{c.accepted.signerFullName} ({c.accepted.signerTitle})</>
                      : "Sin aceptación"}
                  </div>
                  <div className="shrink-0"><Badge tone={st.tone}>{st.label}</Badge></div>
                </Card>
              );
            })}
            {shown.length === 0 && <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Nada que mostrar con este filtro.</p>}
          </div>
        </>}
    </div>
  );
}
