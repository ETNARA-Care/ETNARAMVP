import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileCheck2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getToken } from "@/auth/token";
import {
  listPlatformEstablishmentDocuments,
  openPlatformEstablishmentDocument,
  reviewPlatformEstablishmentDocument,
  type PlatformEstablishmentDocument,
} from "@/api/platformCredentials";
import { Button, Card, EmptyState, Modal, PageHeader, Skeleton, Textarea, useToast } from "@/components/ui";

export function PlatformCredentialVerificationPage() {
  const [documents, setDocuments] = useState<PlatformEstablishmentDocument[] | null>(null);
  const [selected, setSelected] = useState<PlatformEstablishmentDocument | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setDocuments(await listPlatformEstablishmentDocuments(token));
    } catch {
      setDocuments(null);
      toast.show("No pudimos cargar los documentos de establecimientos.", "danger");
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  async function openDocument(document: PlatformEstablishmentDocument) {
    const token = getToken();
    if (!token) return;
    try {
      window.location.assign(await openPlatformEstablishmentDocument(document.id, token));
    } catch {
      toast.show("No pudimos abrir el documento.", "danger");
    }
  }

  async function decide(status: "approved" | "rejected") {
    if (!selected) return;
    if (status === "rejected" && !notes.trim()) {
      toast.show("Indica el motivo del rechazo.", "warning");
      return;
    }
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await reviewPlatformEstablishmentDocument(selected.id, status, notes, token);
      setSelected(null);
      setNotes("");
      await load();
      toast.show(status === "approved" ? "Documento aprobado." : "Documento rechazado.", "success");
    } catch {
      toast.show("No pudimos guardar la decisión.", "danger");
    } finally {
      setSaving(false);
    }
  }

  const pending = (documents ?? []).filter((item) => item.review_status === "pending");

  return (
    <div className="space-y-[var(--spacing-md)]">
      <div className="rounded-2xl bg-[var(--color-navy-900)] p-5 text-white sm:p-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">ETNARA · Centro Administrativo</p>
        <h1 className="font-display text-3xl">Compliance de establecimientos</h1>
        <p className="mt-2 text-sm text-white/80">Revisión de licencias y documentos institucionales. Los expedientes de empleados y residentes permanecen privados dentro de cada organización.</p>
        <div className="mt-5 rounded-xl bg-white/10 p-3"><p className="text-xs text-white/70">Documentos pendientes</p><p className="text-2xl font-semibold">{documents === null ? "—" : pending.length}</p></div>
      </div>

      <PageHeader
        title="Cola de revisión"
        description="Solo documentos institucionales del establecimiento."
        actions={<><Button variant="secondary" icon={<ArrowLeft size={17}/>} onClick={() => navigate("/platform")}>Resumen</Button><Button variant="secondary" icon={<RefreshCw size={17}/>} onClick={() => void load()}>Actualizar</Button></>}
      />

      {documents === null ? <Skeleton className="h-40" /> : pending.length === 0 ? (
        <Card><EmptyState icon={<FileCheck2 size={30}/>} title="No hay documentos pendientes" description="Los documentos institucionales cargados por organizaciones aparecerán aquí." /></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {pending.map((document) => (
            <Card key={document.id} className="flex flex-col gap-3">
              <div>
                <h3 className="font-display text-[var(--text-h3)]">{document.establishment_name}</h3>
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{document.organization_name} · {document.document_type}</p>
              </div>
              <p className="text-[var(--text-small)]">{document.file_name}{document.expires_on ? ` · Vence ${document.expires_on}` : ""}</p>
              <div className="flex gap-2"><Button variant="secondary" icon={<ExternalLink size={16}/>} onClick={() => void openDocument(document)}>Ver documento</Button><Button onClick={() => { setSelected(document); setNotes(""); }}>Revisar</Button></div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => !saving && setSelected(null)}
        title="Revisar documento del establecimiento"
        footer={<><Button variant="secondary" disabled={saving} onClick={() => setSelected(null)}>Cancelar</Button><Button variant="danger" disabled={saving} onClick={() => void decide("rejected")}>Rechazar</Button><Button loading={saving} onClick={() => void decide("approved")}>Aprobar</Button></>}
      >
        <p className="mb-3 text-[var(--text-small)]">{selected?.organization_name} · {selected?.establishment_name} · {selected?.document_type}</p>
        <Textarea label="Notas de revisión" value={notes} onChange={(event) => setNotes(event.target.value)} hint="Obligatorias al rechazar." />
      </Modal>
    </div>
  );
}
