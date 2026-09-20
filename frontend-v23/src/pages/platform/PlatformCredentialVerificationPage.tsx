import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileCheck2, RefreshCw, ShieldAlert } from "lucide-react";
import { getToken } from "@/auth/token";
import {
  listPlatformCredentialQueue,
  openPlatformCredentialDocument,
  verifyPlatformCredential,
  type PlatformCredentialQueueItem,
  type PlatformVerificationStatus,
} from "@/api/platformCredentials";
import {
  Badge, Button, Card, EmptyState, ErrorState, Modal, PageHeader, Skeleton, Textarea, useToast,
} from "@/components/ui";

type QueueFilter = "all" | PlatformVerificationStatus;

const statusPresentation: Record<PlatformVerificationStatus, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "Pendiente", tone: "warning" },
  verified: { label: "Verificada", tone: "success" },
  rejected: { label: "Rechazada", tone: "danger" },
};

export function PlatformCredentialVerificationPage() {
  const [credentials, setCredentials] = useState<PlatformCredentialQueueItem[] | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("pending");
  const [selected, setSelected] = useState<PlatformCredentialQueueItem | null>(null);
  const [notes, setNotes] = useState("");
  const [loadingDocument, setLoadingDocument] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setError(false);
    try {
      setCredentials(await listPlatformCredentialQueue(token));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const base = { all: credentials?.length ?? 0, pending: 0, verified: 0, rejected: 0 };
    for (const credential of credentials ?? []) base[credential.verification_status] += 1;
    return base;
  }, [credentials]);

  const visible = useMemo(
    () => (credentials ?? []).filter((credential) => filter === "all" || credential.verification_status === filter),
    [credentials, filter],
  );

  async function openDocument(credential: PlatformCredentialQueueItem) {
    const token = getToken();
    if (!token) return;
    setLoadingDocument(credential.credential_id);
    try {
      const url = await openPlatformCredentialDocument(credential.credential_id, credential.file_id, token);
      window.location.assign(url);
    } catch {
      toast.show("No pudimos abrir el documento actual.", "danger");
    } finally {
      setLoadingDocument(null);
    }
  }

  function startReview(credential: PlatformCredentialQueueItem) {
    setSelected(credential);
    setNotes(credential.verification_notes ?? "");
  }

  async function saveDecision(status: "verified" | "rejected") {
    if (!selected) return;
    if (status === "rejected" && !notes.trim()) {
      toast.show("Explica el motivo del rechazo para que la agencia pueda corregirlo.", "warning");
      return;
    }
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await verifyPlatformCredential(selected.credential_id, status, notes, token);
      toast.show(status === "verified" ? "Credencial verificada." : "Credencial rechazada.", "success");
      setSelected(null);
      setNotes("");
      await load();
    } catch {
      toast.show("No pudimos guardar la decisión.", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-[var(--spacing-md)]">
      <PageHeader
        title="Verificación de credenciales"
        description="Revisa documentos reales. La aptitud se recalcula automáticamente al aprobar o rechazar."
        actions={<Button variant="secondary" icon={<RefreshCw size={17} />} onClick={() => void load()}>Actualizar</Button>}
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Resumen de verificaciones">
        {(["pending", "verified", "rejected", "all"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            aria-pressed={filter === status}
            className={`rounded-[var(--radius-md)] border p-3 text-left transition-colors ${
              filter === status
                ? "border-[var(--color-navy-800)] bg-[var(--color-navy-800)] text-white"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
            }`}
          >
            <span className="block text-[var(--text-caption)] uppercase tracking-wide">
              {status === "all" ? "Todas" : statusPresentation[status].label}
            </span>
            <span className="font-display text-[var(--text-h2)]">{counts[status]}</span>
          </button>
        ))}
      </div>

      {credentials === null && !error ? (
        <div className="space-y-3"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      ) : error ? (
        <Card><ErrorState kind="server" onRetry={() => void load()} /></Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileCheck2 size={30} />}
            title={filter === "pending" ? "No hay credenciales pendientes" : "No hay credenciales en este estado"}
            description="La cola se alimenta únicamente con documentos cargados por las organizaciones."
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((credential) => {
            const status = statusPresentation[credential.verification_status];
            return (
              <Card key={`${credential.credential_id}-${credential.file_id}`} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{credential.worker_name}</h2>
                    <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{credential.credential_type_name}</p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[var(--text-small)]">
                  <Info label="Organización" value={credential.organization_names.join(", ") || "Sin organización activa"} />
                  <Info label="Emisor" value={credential.issuing_entity_name || "No indicado"} />
                  <Info label="Archivo" value={credential.original_filename} />
                  <Info label="Vencimiento" value={formatDate(credential.expires_at)} />
                </dl>
                {credential.verification_notes && (
                  <p className="rounded-[var(--radius-sm)] bg-[var(--color-ivory-100)] p-2 text-[var(--text-small)] text-[var(--color-text-secondary)]">
                    Última nota: {credential.verification_notes}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<ExternalLink size={17} />} loading={loadingDocument === credential.credential_id} onClick={() => void openDocument(credential)}>
                    Ver documento
                  </Button>
                  <Button icon={<ShieldAlert size={17} />} onClick={() => startReview(credential)}>Revisar</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => !saving && setSelected(null)}
        title="Decisión de plataforma"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)} disabled={saving}>Cancelar</Button>
            <Button variant="danger" onClick={() => void saveDecision("rejected")} disabled={saving}>Rechazar</Button>
            <Button onClick={() => void saveDecision("verified")} loading={saving}>Verificar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
            {selected?.worker_name} · {selected?.credential_type_name}. Verifica que el documento corresponda a la persona y esté vigente.
          </p>
          <Textarea label="Notas de revisión" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} hint="Obligatorias al rechazar; visibles para seguimiento interno." />
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{label}</dt><dd className="break-words text-[var(--color-text-primary)]">{value}</dd></div>;
}

function formatDate(value: string | null): string {
  if (!value) return "Sin vencimiento";
  return new Intl.DateTimeFormat("es-US", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}
