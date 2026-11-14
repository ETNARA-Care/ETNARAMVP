import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Download, FileSignature, History } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { contractsApi, saveBlob, type AgencyContract, type AgencyContractAcceptance } from "@/api/contracts";
import type { ApiError } from "@/api/client";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SectionHeader, Skeleton } from "@/components/ui";
import { acceptanceLabel, contractDate, contractDateTime } from "@/features/contracts/contractFormat";

/**
 * Contratos de la organización (módulo contractual, Etapa 2). Solo la administración: ve los
 * documentos vigentes, su estado, el historial de aceptaciones y descarga las constancias.
 * Informativo: no bloquea ninguna otra pantalla.
 */
export function AgencyContractsPage() {
  const { activeOrganization, roles } = useAuth();
  const organizationId = activeOrganization?.id;
  const isAdmin = roles.includes("ORGANIZATION_ADMIN");
  const [contracts, setContracts] = useState<AgencyContract[] | null | "error" | "forbidden" | "unavailable">(null);
  const [history, setHistory] = useState<AgencyContractAcceptance[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setContracts(null);
    try {
      const [c, h] = await Promise.all([contractsApi.list(organizationId, token), contractsApi.acceptances(organizationId, token)]);
      setContracts(c.contracts); setHistory(h.acceptances);
    } catch (e) {
      const s = (e as ApiError).status;
      setContracts(s === 403 ? "forbidden" : s === 404 ? "unavailable" : "error");
    }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  const certificate = async (a: AgencyContractAcceptance) => {
    const token = getToken();
    if (!organizationId || !token) return;
    setBusy(a.id);
    try { saveBlob(await contractsApi.certificate(organizationId, a.id, token), `constancia-${a.code}-v${a.version_label}.pdf`); } finally { setBusy(null); }
  };

  if (!isAdmin || contracts === "forbidden") {
    return (
      <div className="flex flex-col gap-[var(--spacing-md)]">
        <PageHeader title="Contratos" />
        <Card data-testid="contracts-not-authorized"><p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Solo una administradora o administrador activo de la organización puede consultar y firmar los contratos con ETNARA.</p></Card>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title="Contratos" description="Documentos de tu organización con ETNARA Care. Léelos, descárgalos y, cuando corresponda, acéptalos en nombre de la organización." />
      {contracts === null ? <Skeleton className="h-40" />
        : contracts === "error" ? <ErrorState kind="server" onRetry={() => void load()} />
        : contracts === "unavailable" ? <EmptyState icon={<FileSignature size={28} />} title="Contratos no disponibles" description="Esta sección todavía no está activa para tu organización." />
        : contracts.length === 0 ? <EmptyState icon={<FileSignature size={28} />} title="No hay documentos vigentes" description="Cuando ETNARA publique un documento para tu organización aparecerá aquí." />
        : (
          <div className="flex flex-col gap-3" data-testid="contracts-list">
            {contracts.some((c) => c.isNewVersion && c.acceptance === "pending") && (
              <Card data-testid="contracts-new-version-notice" className="border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)]">
                <p className="text-[var(--text-small)] font-medium text-[var(--color-warning-700)]">Hay una versión nueva de un documento que tu organización ya había aceptado. Revísala y acéptala; tus aceptaciones anteriores se conservan en el historial.</p>
              </Card>
            )}
            {contracts.map((c) => {
              const st = acceptanceLabel(c.acceptance, c.isNewVersion);
              return (
                <Link key={c.id} to={`/agency/contracts/${c.id}`} data-testid="contract-row" className="block">
                  <Card className="flex items-center gap-3 hover:border-[var(--color-navy-700)]">
                    <FileSignature className="shrink-0 text-[var(--color-navy-700)]" size={22} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--color-text-primary)]">{c.title}</p>
                      <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Versión {c.version_label} · publicada el {contractDate(c.published_at)}
                        {c.currentAcceptance ? ` · aceptada el ${contractDate(c.currentAcceptance.acceptedAt)} por ${c.currentAcceptance.signerFullName}` : ""}
                        {!c.currentAcceptance && c.previousAcceptance ? ` · aceptaste la versión ${c.previousAcceptance.versionLabel} el ${contractDate(c.previousAcceptance.acceptedAt)}` : ""}</p>
                      <div className="mt-2 flex flex-wrap gap-2"><Badge tone={st.tone}>{st.label}</Badge>{c.is_test && <Badge tone="danger">Documento de prueba</Badge>}</div>
                    </div>
                    <ChevronRight className="shrink-0 text-[var(--color-text-muted)]" size={20} />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

      {Array.isArray(contracts) && (
        <section className="flex flex-col gap-3" data-testid="contracts-history">
          <SectionHeader title="Historial de aceptaciones" />
          {history.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Tu organización todavía no ha aceptado ningún documento.</p>
            : [...history].reverse().map((a) => (
              <Card key={a.id} className="flex flex-col gap-2 sm:flex-row sm:items-center" data-testid="history-row">
                <History className="hidden shrink-0 text-[var(--color-text-muted)] sm:block" size={20} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.title} · versión {a.version_label}</p>
                  <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Aceptada el {contractDateTime(a.accepted_at)} por {a.signer_full_name} ({a.signer_title}) · verificada con código por correo{a.version_status === "retired" ? " · versión reemplazada" : ""}</p>
                </div>
                <Button variant="secondary" size="sm" icon={<Download size={16} />} loading={busy === a.id} onClick={() => void certificate(a)} data-testid="history-certificate">Constancia</Button>
              </Card>
            ))}
        </section>
      )}
    </div>
  );
}
