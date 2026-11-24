import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Paperclip, RefreshCcw } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { PRACTICE_STATUS_LABEL, PRACTICE_STATUS_TONE, practiceApi, type PracticeDocument, type PracticeDocuments } from "@/api/practice";
import { isIndependentOrganization } from "@/features/practice/modality";
import { uploadMyCredentialDocument } from "@/api/credentials";

/**
 * 161 (PR C): «Mis documentos» del cuidador independiente. Registra, corrige, renueva y retira SUS documentos
 * profesionales. Son AUTODECLARADOS: ETNARA Care no los verifica, aprueba ni certifica. Estados solo por fechas.
 */
type Form = { mode: "new" | "renew" | "edit"; id?: string; credentialTypeCode: string; issuingEntityName: string; issuedAt: string; expiresAt: string };

export function PracticeDocumentsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const toast = useToast();
  const [data, setData] = useState<PracticeDocuments | null>(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingRequirements, setEditingRequirements] = useState<string[] | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try { setData(await practiceApi.documents(organizationId, token)); } catch { setError(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  if (!isIndependentOrganization(activeOrganization)) return <Navigate to="/agency" replace />;

  function open(mode: Form["mode"], doc?: PracticeDocument, code?: string) {
    setForm({
      mode, id: mode === "edit" ? doc?.id : undefined,
      credentialTypeCode: doc?.credentialTypeCode ?? code ?? data?.credentialTypes[0]?.code ?? "",
      issuingEntityName: mode === "edit" ? doc?.issuingEntityName ?? "" : doc?.issuingEntityName ?? "",
      issuedAt: mode === "edit" ? doc?.issuedAt ?? "" : "",
      expiresAt: mode === "edit" ? doc?.expiresAt ?? "" : "",
    });
  }

  async function save() {
    const token = getToken();
    if (!organizationId || !token || !form) return;
    if (form.issuedAt && form.expiresAt && form.issuedAt > form.expiresAt) { toast.show("La fecha de vencimiento debe ser posterior a la de emisión.", "warning"); return; }
    setSaving(true);
    try {
      if (form.mode === "edit" && form.id) {
        await practiceApi.update(organizationId, form.id, { issuingEntityName: form.issuingEntityName.trim() || null, issuedAt: form.issuedAt || null, expiresAt: form.expiresAt || null }, token);
      } else {
        await practiceApi.register(organizationId, {
          credentialTypeCode: form.credentialTypeCode,
          ...(form.issuingEntityName.trim() ? { issuingEntityName: form.issuingEntityName.trim() } : {}),
          ...(form.issuedAt ? { issuedAt: form.issuedAt } : {}),
          ...(form.expiresAt ? { expiresAt: form.expiresAt } : {}),
        }, token);
      }
      toast.show("Documento registrado.", "success");
      setForm(null);
      await load();
    } catch {
      toast.show("No pudimos guardar el documento.", "danger");
    } finally { setSaving(false); }
  }

  async function retire(doc: PracticeDocument) {
    const token = getToken();
    if (!organizationId || !token) return;
    try { await practiceApi.update(organizationId, doc.id, { retire: true }, token); toast.show("Documento retirado. Queda en tu historial.", "success"); await load(); }
    catch { toast.show("No pudimos retirar el documento.", "danger"); }
  }

  // 161: el archivo va al almacenamiento seguro existente (mismo flujo que «Mis credenciales» de la cuidadora).
  async function attach(doc: PracticeDocument, file: File | undefined) {
    const token = getToken();
    if (!organizationId || !token || !file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) { toast.show("Usa un PDF, JPG o PNG.", "warning"); return; }
    setUploading(doc.id);
    try { await uploadMyCredentialDocument(organizationId, doc.id, file, token); toast.show("Archivo adjuntado.", "success"); await load(); }
    catch { toast.show("No pudimos adjuntar el archivo.", "danger"); }
    finally { setUploading(null); }
  }

  async function saveName() {
    const token = getToken();
    const value = (name ?? "").trim();
    if (!organizationId || !token || value.length < 2) return;
    setSaving(true);
    try { await practiceApi.saveProfile(organizationId, value, token); toast.show("Nombre profesional guardado.", "success"); setName(null); await load(); }
    catch { toast.show("No pudimos guardar tu nombre profesional.", "danger"); }
    finally { setSaving(false); }
  }

  async function saveRequirements() {
    const token = getToken();
    if (!organizationId || !token || !editingRequirements || editingRequirements.length === 0) return;
    setSaving(true);
    try { await practiceApi.saveRequirements(organizationId, editingRequirements, token); toast.show("Requisitos de tu práctica guardados.", "success"); setEditingRequirements(null); await load(); }
    catch { toast.show("No pudimos guardar tus requisitos.", "danger"); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]" data-testid="practice-documents">
      <PageHeader title="Mis documentos" description="Registra y renueva tus documentos profesionales. Son autodeclarados: los registras tú."
        actions={<Button icon={<FilePlus2 size={18} />} onClick={() => open("new")} disabled={!data}>Registrar documento</Button>} />
      <Card data-testid="practice-documents-notice"><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{data?.notice ?? "ETNARA Care no verifica, aprueba ni certifica documentos."}</p></Card>

      {data === null && !error ? <Skeleton className="h-40" /> : error || !data ? <ErrorState kind="server" onRetry={() => void load()} /> : (
        <>
          <Card className="flex flex-col gap-2" data-testid="practice-professional-name">
            <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Nombre profesional</h2>
            <p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">Es el nombre que verán tus clientes y sus familias en tus informes de visita.</p>
            {name === null && data.professionalName
              ? <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-[var(--color-text-primary)]">{data.professionalName}</span><Button size="sm" variant="ghost" onClick={() => setName(data.professionalName ?? "")}>Cambiar</Button></div>
              : <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  {!data.professionalName && <p className="text-[length:var(--text-small)] text-[var(--color-warning-700)]">Sin nombre profesional no podrás publicar informes a las familias.</p>}
                  <Input label="Tu nombre profesional" value={name ?? ""} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Ej.: María Rivera, CNA" />
                  <Button loading={saving} disabled={(name ?? "").trim().length < 2} onClick={() => void saveName()} data-testid="practice-professional-name-save">Guardar</Button>
                </div>}
          </Card>

          <Card className="flex flex-col gap-2" data-testid="practice-requirements">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Requisitos de mi práctica</h2>
              <Button size="sm" variant="secondary" onClick={() => setEditingRequirements(data.requirements.map((r) => r.credentialTypeCode))}>Elegir requisitos</Button>
            </div>
            {!data.policyConfigured ? <p className="text-[var(--color-text-secondary)]">No has definido requisitos. Puedes trabajar sin ellos; si los defines, te avisaremos de lo que falte o venza.</p> : (
              <ul className="flex flex-col gap-1">{data.requirements.map((r) => (
                <li key={r.credentialTypeCode} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[var(--color-text-primary)]">{r.name}{r.expiresAt ? ` · vence ${r.expiresAt}` : ""}</span>
                  <span className="flex items-center gap-2"><Badge tone={PRACTICE_STATUS_TONE[r.status]}>{PRACTICE_STATUS_LABEL[r.status]}</Badge>
                    {r.status === "MISSING" && <Button size="sm" variant="ghost" onClick={() => open("new", undefined, r.credentialTypeCode)}>Registrar</Button>}</span>
                </li>))}</ul>
            )}
          </Card>

          {data.documents.length === 0 ? <EmptyState title="Sin documentos registrados" description="Cuando registres un documento aparecerá aquí con su estado según sus fechas." /> : (
            <ul className="flex flex-col gap-2">{data.documents.map((d) => (
              <li key={d.id}><Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text-primary)]">{d.name}</p>
                  <p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">
                    {d.selfDeclared ? "Autodeclarado" : "Registrado por una agencia"}{d.issuingEntityName ? ` · ${d.issuingEntityName}` : ""}{d.expiresAt ? ` · vence ${d.expiresAt}` : " · sin vencimiento"}{d.hasFile ? " · archivo adjunto" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={PRACTICE_STATUS_TONE[d.status]}>{PRACTICE_STATUS_LABEL[d.status]}</Badge>
                  {d.selfDeclared && d.status !== "RETIRED" && <>
                    <label className={`inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-[length:var(--text-small)] text-[var(--color-text-primary)] ${uploading === d.id ? "opacity-60" : ""}`}>
                      <Paperclip size={16} aria-hidden />{d.hasFile ? "Reemplazar archivo" : "Adjuntar archivo"}
                      <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png" disabled={uploading !== null} data-testid={`practice-attach-${d.id}`}
                        onChange={(e) => { void attach(d, e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                    <Button size="sm" variant="secondary" icon={<RefreshCcw size={16} />} onClick={() => open("renew", d)}>Renovar</Button>
                    <Button size="sm" variant="ghost" onClick={() => open("edit", d)}>Corregir</Button>
                    <Button size="sm" variant="ghost" onClick={() => void retire(d)}>Retirar</Button>
                  </>}
                </div>
              </Card></li>))}</ul>
          )}
        </>
      )}

      <Modal open={form !== null} onClose={() => !saving && setForm(null)} sheetOnMobile title={form?.mode === "renew" ? "Renovar documento" : form?.mode === "edit" ? "Corregir documento" : "Registrar documento"}
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" disabled={saving} onClick={() => setForm(null)}>Cancelar</Button><Button loading={saving} onClick={() => void save()} data-testid="practice-document-save">Guardar</Button></div>}>
        {form && <div className="flex flex-col gap-3">
          <Select label="Tipo de documento" value={form.credentialTypeCode} disabled={form.mode !== "new"} onChange={(e) => setForm({ ...form, credentialTypeCode: e.target.value })}>
            {data?.credentialTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </Select>
          <Input label="Entidad que lo emitió (opcional)" value={form.issuingEntityName} maxLength={200} onChange={(e) => setForm({ ...form, issuingEntityName: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Fecha de emisión" type="date" value={form.issuedAt} onChange={(e) => setForm({ ...form, issuedAt: e.target.value })} />
            <Input label="Fecha de vencimiento" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          <p className="text-[length:var(--text-small)] text-[var(--color-text-muted)]">Es tu declaración. ETNARA Care no verifica, aprueba ni certifica documentos.</p>
        </div>}
      </Modal>

      <Modal open={editingRequirements !== null} onClose={() => !saving && setEditingRequirements(null)} sheetOnMobile title="Requisitos de mi práctica"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" disabled={saving} onClick={() => setEditingRequirements(null)}>Cancelar</Button><Button loading={saving} disabled={!editingRequirements?.length} onClick={() => void saveRequirements()}>Guardar</Button></div>}>
        <fieldset className="flex flex-col">
          <legend className="mb-2 text-[length:var(--text-small)] text-[var(--color-text-secondary)]">Elige los documentos que tu práctica exige. Te avisaremos si alguno falta o vence.</legend>
          {data?.credentialTypes.map((t) => (
            <label key={t.code} className="flex min-h-11 items-center gap-2 border-b border-[var(--color-border)] last:border-b-0">
              <input type="checkbox" className="h-5 w-5" checked={editingRequirements?.includes(t.code) ?? false}
                onChange={(e) => setEditingRequirements((cur) => (e.target.checked ? [...(cur ?? []), t.code] : (cur ?? []).filter((c) => c !== t.code)))} />
              {t.name}
            </label>))}
        </fieldset>
      </Modal>
    </div>
  );
}
