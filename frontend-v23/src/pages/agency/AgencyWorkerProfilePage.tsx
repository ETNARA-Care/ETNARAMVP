import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Eye, FileText, Plus, ShieldCheck, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listWorkers, type WorkerMembership } from "@/api/shifts";
import { updateWorker } from "@/api/roster";
import {
  createWorkerCredential,
  listCredentialDocuments,
  listCredentialTypes,
  listWorkerCredentials,
  openCredentialDocument,
  reviewWorkerCredential,
  uploadCredentialDocument,
  updateWorkerCredential,
  type CredentialDocumentVersion,
  type CredentialTypeCatalogItem,
  type WorkerCredential,
} from "@/api/agencyCredentials";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { WorkerCredentialBadge } from "./WorkerCredentialBadge";
import { formatCredentialDate } from "./workerCredentialUtils";
import { AccessInvitationPanel } from "./AccessInvitationPanel";

export function AgencyWorkerProfilePage() {
  const { membershipId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [worker, setWorker] = useState<WorkerMembership | null | undefined>(undefined);
  const [credentials, setCredentials] = useState<WorkerCredential[]>([]);
  const [credentialTypes, setCredentialTypes] = useState<CredentialTypeCatalogItem[]>([]);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ displayName: "", internalRole: "CNA", hiredAt: "" });
  const [creatingCredential, setCreatingCredential] = useState(false);
  const [editingCredential, setEditingCredential] = useState<WorkerCredential | null>(null);
  const [confirmingCredentialRevocation, setConfirmingCredentialRevocation] = useState(false);
  const [credentialDocuments, setCredentialDocuments] = useState<CredentialDocumentVersion[]>([]);
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [credentialForm, setCredentialForm] = useState({
    credentialTypeCode: "",
    issuingEntityName: "",
    issuingEntityType: "external_provider" as "government" | "external_provider" | "platform",
    issuedAt: "",
    expiresAt: "",
    status: "active" as "active" | "expired",
  });
  const toast = useToast();

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !membershipId || !token) return;
    setError(false);
    try {
      const workers = await listWorkers(organizationId, token);
      const selectedWorker = workers.find((row) => row.id === membershipId) ?? null;
      setWorker(selectedWorker);
      if (!selectedWorker) {
        setCredentials([]);
        setCredentialTypes([]);
        return;
      }
      const [credentialRows, catalog] = await Promise.all([
        listWorkerCredentials(organizationId, selectedWorker.worker_id, token),
        listCredentialTypes(organizationId, token),
      ]);
      setCredentials(credentialRows);
      setCredentialTypes(catalog);
    } catch {
      setWorker(null);
      setError(true);
    }
  }, [membershipId, organizationId]);

  useEffect(() => { void load(); }, [load]);

  const openEdit = () => {
    if (!worker) return;
    setForm({
      displayName: worker.display_name ?? "",
      internalRole: worker.internal_role,
      hiredAt: worker.hired_at?.slice(0, 10) ?? "",
    });
    setEditing(true);
  };

  const openCredentialCreate = () => {
    setCredentialForm({
      credentialTypeCode: credentialTypes[0]?.code ?? "",
      issuingEntityName: "",
      issuingEntityType: "external_provider",
      issuedAt: "",
      expiresAt: "",
      status: "active",
    });
    setCreatingCredential(true);
  };

  const openCredentialEdit = async (credential: WorkerCredential) => {
    setCredentialForm({
      credentialTypeCode: credential.type_code,
      issuingEntityName: credential.issuing_entity_name ?? "",
      issuingEntityType: credential.issuing_entity_type,
      issuedAt: credential.issued_at ?? "",
      expiresAt: credential.expires_at ?? "",
      status: credential.status === "expired" ? "expired" : "active",
    });
    setCredentialDocuments([]);
    setCredentialFile(null);
    setReviewNotes(credential.organization_review_notes ?? "");
    setEditingCredential(credential);
    const token = getToken();
    if (!organizationId || !worker || !token) return;
    try {
      setCredentialDocuments(await listCredentialDocuments(organizationId, worker.worker_id, credential.id, token));
    } catch {
      toast.show("No pudimos cargar el historial documental.", "danger");
    }
  };

  const credentialDatesAreValid = !credentialForm.issuedAt || !credentialForm.expiresAt
    || credentialForm.expiresAt >= credentialForm.issuedAt;

  const saveCredential = async () => {
    const token = getToken();
    if (!organizationId || !worker || !token || !credentialForm.credentialTypeCode || !credentialDatesAreValid) return;
    setSaving(true);
    try {
      await createWorkerCredential(organizationId, worker.worker_id, {
        credentialTypeCode: credentialForm.credentialTypeCode,
        issuingEntityType: credentialForm.issuingEntityType,
        ...(credentialForm.issuingEntityName.trim() ? { issuingEntityName: credentialForm.issuingEntityName.trim() } : {}),
        ...(credentialForm.issuedAt ? { issuedAt: credentialForm.issuedAt } : {}),
        ...(credentialForm.expiresAt ? { expiresAt: credentialForm.expiresAt } : {}),
      }, token);
      setCreatingCredential(false);
      await load();
      toast.show("Credencial registrada correctamente.", "success");
    } catch {
      toast.show("No pudimos registrar la credencial.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const saveCredentialChanges = async () => {
    const token = getToken();
    if (!organizationId || !worker || !editingCredential || !token || !credentialDatesAreValid) return;
    setSaving(true);
    try {
      await updateWorkerCredential(organizationId, worker.worker_id, editingCredential.id, {
        issuingEntityName: credentialForm.issuingEntityName.trim(),
        issuingEntityType: credentialForm.issuingEntityType,
        issuedAt: credentialForm.issuedAt || null,
        expiresAt: credentialForm.expiresAt || null,
        status: credentialForm.status,
      }, token);
      setEditingCredential(null);
      await load();
      toast.show("Credencial actualizada correctamente.", "success");
    } catch {
      toast.show("No pudimos actualizar la credencial.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const revokeCredential = async () => {
    const token = getToken();
    if (!organizationId || !worker || !editingCredential || !token) return;
    setSaving(true);
    try {
      await updateWorkerCredential(organizationId, worker.worker_id, editingCredential.id, { status: "revoked" }, token);
      setConfirmingCredentialRevocation(false);
      setEditingCredential(null);
      await load();
      toast.show("Credencial revocada; el historial se conserva.", "success");
    } catch {
      toast.show("No pudimos revocar la credencial.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async () => {
    const token = getToken();
    if (!organizationId || !worker || !editingCredential || !credentialFile || !token) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(credentialFile.type)) {
      toast.show("Selecciona un PDF, JPG o PNG.", "danger");
      return;
    }
    if (credentialFile.size > 10 * 1024 * 1024) {
      toast.show("El documento no puede superar 10 MB.", "danger");
      return;
    }
    setSaving(true);
    try {
      await uploadCredentialDocument(organizationId, worker.worker_id, editingCredential.id, credentialFile, token);
      setCredentialDocuments(await listCredentialDocuments(organizationId, worker.worker_id, editingCredential.id, token));
      setEditingCredential((current) => current ? { ...current, document_status: "presented", organization_review_status: "pending" } : current);
      setCredentialFile(null);
      await load();
      toast.show("Documento cargado de forma privada y enviado a revisión.", "success");
    } catch {
      toast.show("No pudimos cargar el documento. Verifica el almacenamiento seguro.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const openDocument = async (document: CredentialDocumentVersion) => {
    const token = getToken();
    if (!organizationId || !worker || !editingCredential || !token) return;
    try {
      const downloadUrl = await openCredentialDocument(organizationId, worker.worker_id, editingCredential.id, document.file_id, token);
      window.location.assign(downloadUrl);
    } catch {
      toast.show("No pudimos abrir el documento privado.", "danger");
    }
  };

  const reviewCredential = async (reviewStatus: "approved" | "rejected") => {
    const token = getToken();
    if (!organizationId || !membershipId || !editingCredential || !token) return;
    if (reviewStatus === "rejected" && !reviewNotes.trim()) {
      toast.show("Indica el motivo del rechazo.", "danger");
      return;
    }
    setSaving(true);
    try {
      await reviewWorkerCredential(organizationId, membershipId, editingCredential.id, reviewStatus, reviewNotes, token);
      setEditingCredential(null);
      await load();
      toast.show(reviewStatus === "approved" ? "Documento aprobado." : "Documento rechazado.", "success");
    } catch {
      toast.show("No pudimos registrar la revisión.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const saveWorker = async () => {
    const token = getToken();
    if (!organizationId || !membershipId || !token || !form.displayName.trim() || !form.internalRole.trim()) return;
    setSaving(true);
    try {
      const updated = await updateWorker(organizationId, membershipId, {
        displayName: form.displayName.trim(),
        internalRole: form.internalRole,
        hiredAt: form.hiredAt || null,
      }, token);
      setWorker((current) => current ? { ...current, ...updated } : current);
      setEditing(false);
      toast.show("Información del personal actualizada.", "success");
    } catch {
      toast.show("No pudimos actualizar la información.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    const token = getToken();
    if (!organizationId || !membershipId || !worker || !token) return;
    const active = worker.status !== "active";
    setSaving(true);
    try {
      const updated = await updateWorker(organizationId, membershipId, {
        status: active ? "active" : "inactive",
        endedAt: active ? null : new Date().toISOString(),
      }, token);
      setWorker((current) => current ? { ...current, ...updated } : current);
      setConfirmingStatus(false);
      toast.show(active ? "Personal reactivado." : "Personal desactivado; su historial se conserva.", "success");
    } catch {
      toast.show("No pudimos cambiar el estado del personal.", "danger");
    } finally {
      setSaving(false);
    }
  };

  if (worker === undefined) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-56" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!worker) return <ErrorState kind="not_found" />;

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate("/agency/workers")} className="self-start">Volver a cuidadores</Button>
      <PageHeader
        title={worker.display_name || "Cuidador sin nombre"}
        description="Información laboral y credenciales verificadas."
        actions={<div className="flex flex-wrap items-center gap-2"><Badge tone={worker.status === "active" ? "success" : "neutral"}>{worker.status === "active" ? "Activo" : "Inactivo"}</Badge><Button variant="secondary" onClick={openEdit}>Editar</Button><Button variant={worker.status === "active" ? "danger" : "primary"} onClick={() => setConfirmingStatus(true)}>{worker.status === "active" ? "Desactivar" : "Reactivar"}</Button></div>}
      />

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <BriefcaseBusiness size={20} className="text-[var(--color-text-muted)]" aria-hidden />
          <h2 className="font-medium text-[var(--color-text-primary)]">Información laboral</h2>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Rol interno" value={worker.internal_role} />
          <Detail label="Estado" value={worker.status === "active" ? "Activo" : "Inactivo"} />
          <Detail label="Fecha de contratación" value={worker.hired_at ? formatCredentialDate(worker.hired_at.slice(0, 10)) : "No registrada"} />
          {worker.ended_at && <Detail label="Fecha de finalización" value={new Date(worker.ended_at).toLocaleDateString("es-PR")} />}
        </dl>
      </Card>

      {organizationId && membershipId && worker.status === "active" && (
        <AccessInvitationPanel organizationId={organizationId} type="worker" workerMembershipId={membershipId} />
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={21} className="text-[var(--color-text-muted)]" aria-hidden />
            <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Credenciales</h2>
          </div>
          {worker.status === "active" && <Button icon={<Plus size={18} />} onClick={openCredentialCreate} disabled={credentialTypes.length === 0}>Agregar credencial</Button>}
        </div>
        {worker.status !== "active" && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mb-3">Reactiva la membresía para registrar o modificar credenciales.</p>}
        {credentials.length === 0 ? (
          <EmptyState title="Sin credenciales registradas" />
        ) : (
          <div className="flex flex-col gap-2">
            {credentials.map((credential) => (
              <Card key={credential.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{credentialTypeLabel(credential.type_code)}</p>
                  <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-1">{credential.expires_at ? `Expira ${formatCredentialDate(credential.expires_at)}` : "Sin fecha de expiración"}</p>
                  {credential.issuing_entity_name && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">Emitida por {credential.issuing_entity_name}</p>}
                </div>
                <div className="flex items-center gap-2"><WorkerCredentialBadge credential={credential} />{credential.document_status && <Badge tone={credential.organization_review_status === "approved" ? "success" : credential.organization_review_status === "rejected" ? "danger" : "warning"}>{credential.organization_review_status === "approved" ? "Documento aprobado" : credential.organization_review_status === "rejected" ? "Documento rechazado" : "Documento pendiente"}</Badge>}{worker.status === "active" && credential.status !== "revoked" && <Button variant="secondary" onClick={() => void openCredentialEdit(credential)}>Gestionar</Button>}</div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={editing}
        onClose={() => !saving && setEditing(false)}
        title="Editar personal"
        footer={<><Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void saveWorker()} loading={saving} disabled={!form.displayName.trim() || !form.internalRole.trim()}>Guardar cambios</Button></>}
      >
        <div className="flex flex-col gap-3">
          <Input label="Nombre completo" value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} required />
          <Select label="Clasificación laboral" value={form.internalRole} onChange={(event) => setForm((current) => ({ ...current, internalRole: event.target.value }))} required>
            <option value="CNA">CNA</option><option value="HHA">HHA</option><option value="RN">RN</option><option value="LPN">LPN</option><option value="SUPERVISOR">Supervisor/a</option><option value="OTRO">Otro</option>
          </Select>
          <Input label="Fecha de contratación (opcional)" type="date" value={form.hiredAt} onChange={(event) => setForm((current) => ({ ...current, hiredAt: event.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={creatingCredential}
        onClose={() => !saving && setCreatingCredential(false)}
        title="Agregar credencial"
        footer={<><Button variant="secondary" onClick={() => setCreatingCredential(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void saveCredential()} loading={saving} disabled={!credentialForm.credentialTypeCode || !credentialDatesAreValid}>Guardar credencial</Button></>}
      >
        <CredentialFormFields form={credentialForm} setForm={setCredentialForm} credentialTypes={credentialTypes} showType showIssuedAt dateError={!credentialDatesAreValid} />
      </Modal>

      <Modal
        open={editingCredential !== null}
        onClose={() => !saving && setEditingCredential(null)}
        title={`Gestionar ${editingCredential ? credentialTypeLabel(editingCredential.type_code) : "credencial"}`}
        footer={<><Button variant="danger" onClick={() => setConfirmingCredentialRevocation(true)} disabled={saving}>Revocar</Button><Button variant="secondary" onClick={() => setEditingCredential(null)} disabled={saving}>Cancelar</Button><Button onClick={() => void saveCredentialChanges()} loading={saving} disabled={!credentialDatesAreValid}>Guardar cambios</Button></>}
      >
        <CredentialFormFields form={credentialForm} setForm={setCredentialForm} credentialTypes={credentialTypes} showIssuedAt dateError={!credentialDatesAreValid} />
        <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex flex-col gap-3">
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">Documento privado</h3>
            <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">PDF, JPG o PNG; máximo 10 MB. Cada reemplazo crea una versión nueva.</p>
          </div>
          <Input label="Seleccionar documento" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setCredentialFile(event.target.files?.[0] ?? null)} />
          <Button variant="secondary" icon={<Upload size={18} />} onClick={() => void uploadDocument()} loading={saving} disabled={!credentialFile}>Cargar documento</Button>
          {credentialDocuments.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Todavía no hay documentos cargados.</p> : (
            <div className="flex flex-col gap-2">
              {credentialDocuments.map((document) => (
                <Card key={document.file_id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0"><FileText size={18} aria-hidden /><div className="min-w-0"><p className="text-[var(--text-small)] text-[var(--color-text-primary)] truncate">{document.original_filename}</p><p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Versión {document.version} · {formatFileSize(document.size_bytes)}{document.is_current ? " · Actual" : ""}</p>{document.review_status && <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)] mt-1">{document.review_status === "approved" ? "Aprobada" : document.review_status === "rejected" ? "Rechazada" : "Pendiente"}{document.review_notes ? ` · ${document.review_notes}` : ""}</p>}</div></div>
                  <Button variant="ghost" icon={<Eye size={17} />} onClick={() => void openDocument(document)}>Ver</Button>
                </Card>
              ))}
            </div>
          )}
          {credentialDocuments.length > 0 && <>
            <Input label="Observaciones de revisión" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Obligatorias si rechazas el documento" />
            <div className="flex flex-wrap gap-2"><Button variant="danger" onClick={() => void reviewCredential("rejected")} disabled={saving}>Rechazar documento</Button><Button onClick={() => void reviewCredential("approved")} disabled={saving}>Aprobar documento</Button></div>
          </>}
        </div>
      </Modal>

      <Modal
        open={confirmingCredentialRevocation}
        onClose={() => !saving && setConfirmingCredentialRevocation(false)}
        title="Revocar credencial"
        footer={<><Button variant="secondary" onClick={() => setConfirmingCredentialRevocation(false)} disabled={saving}>Volver</Button><Button variant="danger" onClick={() => void revokeCredential()} loading={saving}>Sí, revocar</Button></>}
      >
        <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">La credencial dejará de ser válida para cumplimiento y asignaciones. El registro permanecerá en el historial.</p>
      </Modal>

      <Modal
        open={confirmingStatus}
        onClose={() => !saving && setConfirmingStatus(false)}
        title={worker.status === "active" ? "Desactivar personal" : "Reactivar personal"}
        footer={<><Button variant="secondary" onClick={() => setConfirmingStatus(false)} disabled={saving}>Volver</Button><Button variant={worker.status === "active" ? "danger" : "primary"} onClick={() => void changeStatus()} loading={saving}>{worker.status === "active" ? "Sí, desactivar" : "Sí, reactivar"}</Button></>}
      >
        <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">{worker.status === "active" ? "La persona dejará de estar disponible para nuevas asignaciones. Sus turnos, credenciales y actividad permanecerán en el historial." : "La persona volverá a estar disponible para la operación y nuevas asignaciones."}</p>
      </Modal>
    </div>
  );
}

type CredentialFormState = {
  credentialTypeCode: string;
  issuingEntityName: string;
  issuingEntityType: "government" | "external_provider" | "platform";
  issuedAt: string;
  expiresAt: string;
  status: "active" | "expired";
};

function CredentialFormFields({ form, setForm, credentialTypes, showType = false, showIssuedAt = false, dateError = false }: {
  form: CredentialFormState;
  setForm: React.Dispatch<React.SetStateAction<CredentialFormState>>;
  credentialTypes: CredentialTypeCatalogItem[];
  showType?: boolean;
  showIssuedAt?: boolean;
  dateError?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {showType && <Select label="Tipo de credencial" value={form.credentialTypeCode} onChange={(event) => setForm((current) => ({ ...current, credentialTypeCode: event.target.value }))} required>{credentialTypes.map((type) => <option key={type.code} value={type.code}>{credentialTypeLabel(type.code)}</option>)}</Select>}
      <Select label="Entidad emisora" value={form.issuingEntityType} onChange={(event) => setForm((current) => ({ ...current, issuingEntityType: event.target.value as CredentialFormState["issuingEntityType"] }))} required>
        <option value="government">Agencia gubernamental</option><option value="external_provider">Proveedor externo</option><option value="platform">ETNARA / organización</option>
      </Select>
      <Input label="Nombre de la entidad (opcional)" value={form.issuingEntityName} onChange={(event) => setForm((current) => ({ ...current, issuingEntityName: event.target.value }))} />
      {showIssuedAt && <Input label="Fecha de emisión (opcional)" type="date" value={form.issuedAt} onChange={(event) => setForm((current) => ({ ...current, issuedAt: event.target.value }))} />}
      <Input label="Fecha de vencimiento (opcional)" type="date" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} error={dateError ? "La fecha de vencimiento no puede ser anterior a la emisión." : undefined} />
      {!showType && <Select label="Estado" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CredentialFormState["status"] }))}><option value="active">Activa</option><option value="expired">Vencida</option></Select>}
      <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Después de guardar, usa “Documento privado” para adjuntar o reemplazar la evidencia sin perder versiones anteriores.</p>
    </div>
  );
}

function credentialTypeLabel(code: string): string {
  const labels: Record<string, string> = {
    IDENTITY: "Identificación",
    BACKGROUND_CHECK: "Verificación de antecedentes",
    LEY_300: "Certificación Ley 300 / SICHDe",
    CPR: "Certificación CPR",
    BLS: "Certificación BLS",
    PROFESSIONAL_LICENSE: "Licencia profesional",
    INTERNAL_TRAINING: "Adiestramiento interno",
  };
  return labels[code] ?? code.replaceAll("_", " ");
}

function formatFileSize(value: string): string {
  const bytes = Number(value);
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{label}</dt><dd className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">{value}</dd></div>;
}
