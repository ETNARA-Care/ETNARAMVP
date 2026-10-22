import { useCallback, useEffect, useState } from "react";
import { Eye, FileCheck2, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  listPendingCredentialReviews,
  openCredentialDocument,
  reviewWorkerCredential,
  type PendingCredentialReviewItem,
} from "@/api/agencyCredentials";
import { Badge, Button, Card, EmptyState, Modal, Skeleton, Textarea, useToast } from "@/components/ui";

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-PR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function CredentialReviewQueuePanel() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [items, setItems] = useState<PendingCredentialReviewItem[] | null>(null);
  const [selected, setSelected] = useState<PendingCredentialReviewItem | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    try {
      setItems(await listPendingCredentialReviews(organizationId, token));
    } catch {
      setItems([]);
      toast.show("No pudimos cargar las credenciales pendientes.", "danger");
    }
  }, [organizationId, toast]);

  useEffect(() => { void load(); }, [load]);

  async function openDocument(item: PendingCredentialReviewItem) {
    const token = getToken();
    if (!organizationId || !token) return;
    try {
      const url = await openCredentialDocument(
        organizationId,
        item.workerId,
        item.credentialId,
        item.fileId,
        token,
      );
      window.location.assign(url);
    } catch {
      toast.show("No pudimos abrir el documento privado.", "danger");
    }
  }

  async function decide(status: "approved" | "rejected") {
    const token = getToken();
    if (!organizationId || !selected || !token) return;
    if (status === "rejected" && !notes.trim()) {
      toast.show("Indica el motivo del rechazo.", "warning");
      return;
    }
    setSaving(true);
    try {
      await reviewWorkerCredential(
        organizationId,
        selected.membershipId,
        selected.credentialId,
        status,
        notes,
        token,
      );
      toast.show(status === "approved" ? "Documento aprobado." : "Documento rechazado.", "success");
      setSelected(null);
      setNotes("");
      await load();
    } catch {
      toast.show("No pudimos registrar la revisión.", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="credential-review-queue" className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-[var(--spacing-md)]">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="mt-0.5 text-[var(--color-text-muted)]" aria-hidden />
          <div>
            <h2 className="font-display text-[var(--text-h3)]">Credenciales pendientes de revisión</h2>
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
              Documentos enviados por cuidadores de esta organización.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items !== null && <Badge tone={items.length ? "warning" : "success"}>{items.length} pendientes</Badge>}
          <Button variant="secondary" icon={<RefreshCw size={17} />} onClick={() => void load()}>Actualizar</Button>
        </div>
      </div>

      {items === null ? (
        <div className="border-t border-[var(--color-border)] p-[var(--spacing-md)]">
          <Skeleton className="h-28" />
        </div>
      ) : items.length === 0 ? (
        <div className="border-t border-[var(--color-border)] p-[var(--spacing-md)]">
          <EmptyState icon={<FileCheck2 size={28} />} title="No hay documentos pendientes" description="Las nuevas cargas de cuidadores aparecerán aquí." />
        </div>
      ) : (
        <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <div key={item.credentialId} className="flex flex-col gap-3 p-[var(--spacing-md)] lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-text-primary)]">{item.workerDisplayName || "Cuidador"}</p>
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                  {item.credentialTypeName} · {item.originalFilename}
                </p>
                <p className="mt-1 text-[var(--text-caption)] text-[var(--color-text-muted)]">
                  Enviado {formatDate(item.submittedAt)} · {formatBytes(item.sizeBytes)}
                  {item.expiresAt ? ` · Vence ${new Date(item.expiresAt).toLocaleDateString("es-PR")}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<Eye size={17} />} onClick={() => void openDocument(item)}>Ver documento</Button>
                <Button onClick={() => { setSelected(item); setNotes(""); }}>Revisar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => !saving && setSelected(null)}
        title="Revisar credencial"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setSelected(null)}>Cancelar</Button>
            <Button variant="danger" disabled={saving} onClick={() => void decide("rejected")}>Rechazar</Button>
            <Button loading={saving} onClick={() => void decide("approved")}>Aprobar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
            {selected?.workerDisplayName || "Cuidador"} · {selected?.credentialTypeName}
          </p>
          <Textarea
            label="Notas de revisión"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            hint="Obligatorias al rechazar."
          />
        </div>
      </Modal>
    </Card>
  );
}
