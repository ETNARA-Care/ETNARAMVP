import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSignature, ShieldCheck, ToggleLeft, UserCheck } from "lucide-react";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import {
  centralContractError, centralContractsApi, testDocumentBody, testDocumentCode, testDocumentTitle, TEST_BANNER,
  type CentralAcceptance, type CentralContractsOverview, type CentralDocument, type CentralSignatory, type EligibleSignatory,
} from "@/api/contracts";
import { getOrganizationFeatures, setOrganizationFeature } from "@/api/platformOrganizations";
import { Badge, Button, Card, Input, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { acceptanceLabel, contractDate } from "@/features/contracts/contractFormat";

type Org = CentralContractsOverview["organizations"][number];
const errText = (e: unknown) => centralContractError((e as ApiError)?.code, (e as ApiError)?.status);
const STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" }> = {
  draft: { label: "Borrador", tone: "warning" }, published: { label: "Vigente", tone: "success" }, retired: { label: "Retirado", tone: "neutral" },
};

function Section({ icon, title, hint, children, testId }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode; testId: string }) {
  return (
    <Card className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-ivory-100)] text-[var(--color-navy-800)]">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-sans text-[length:1rem] font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-0.5 text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{hint}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

/**
 * ETNARA Central — administrar los contratos de UNA agencia (158). Todo pasa por las rutas
 * existentes del módulo (solo superadministración, auditadas). Aquí solo se crean documentos de
 * PRUEBA dirigidos a esta agencia; el contrato oficial sigue exigiendo aprobación jurídica y no se
 * publica desde esta pantalla. Central nunca firma por la agencia.
 */
export function CentralAgencyContractsPanel({ overview, onChanged }: { overview: CentralContractsOverview; onChanged: () => void }) {
  const toast = useToast();
  const orgs = overview.organizations;
  const [orgId, setOrgId] = useState("");
  const org: Org | undefined = orgs.find((o) => o.organizationId === orgId);

  const [docs, setDocs] = useState<CentralDocument[] | null>(null);
  const [sigs, setSigs] = useState<CentralSignatory[] | null>(null);
  const [eligible, setEligible] = useState<EligibleSignatory[]>([]);
  const [switchOn, setSwitchOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const t = getToken(); if (!t || !orgId) return;
    setDocs(null); setSigs(null); setSwitchOn(null);
    try {
      const [d, s, e, f] = await Promise.all([centralContractsApi.documents(t), centralContractsApi.signatories(t, orgId), centralContractsApi.eligible(t, orgId), getOrganizationFeatures(orgId, t)]);
      setDocs(d.documents); setSigs(s.signatories); setEligible(e.eligible);
      setSwitchOn(f.features.some((x) => x.code === "CONTRACTS" && x.enabled));
    } catch (e) { toast.show(errText(e), "danger"); setDocs([]); setSigs([]); }
  }, [orgId, toast]);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: (t: string) => Promise<unknown>, ok: string) {
    const t = getToken(); if (!t) return false;
    setBusy(true);
    try { await fn(t); toast.show(ok, "success"); await load(); onChanged(); return true; }
    catch (e) { toast.show(errText(e), "danger"); return false; }
    finally { setBusy(false); }
  }

  // ---------------------------------------------------------------- interruptor
  const [switchReason, setSwitchReason] = useState("");
  // ---------------------------------------------------------------- representantes
  const [des, setDes] = useState({ userId: "", fullName: "", title: "", basis: "" });
  const [revoking, setRevoking] = useState<{ id: string; reason: string } | null>(null);
  // ---------------------------------------------------------------- documentos de prueba
  const [newDoc, setNewDoc] = useState({ title: "Ensayo de firma electrónica", text: "PRIMERA. Este documento sirve solo para comprobar el flujo de firma electrónica de ETNARA Care.\nSEGUNDA. No crea obligaciones para ninguna de las partes." });
  const [retiring, setRetiring] = useState<{ id: string; reason: string } | null>(null);
  const [confirmPublish, setConfirmPublish] = useState<string | null>(null);
  const [accOpen, setAccOpen] = useState<{ id: string; rows: CentralAcceptance[] | null } | null>(null);

  const mine = useMemo(() => (docs ?? []).filter((d) => d.organization_id === orgId && d.is_test), [docs, orgId]);
  const generalTestLive = useMemo(() => (docs ?? []).filter((d) => d.is_test && !d.organization_id && d.versions.some((v) => v.status === "published")), [docs]);
  const activeSigs = (sigs ?? []).filter((s) => !s.revoked_at);
  const designatedIds = new Set(activeSigs.map((s) => s.user_id));

  async function createDoc() {
    if (!org) return;
    await run(async (t) => {
      const d = await centralContractsApi.createTestDocument(t, { code: testDocumentCode(org.name), title: testDocumentTitle(newDoc.title), organizationId: org.organizationId });
      await centralContractsApi.createVersion(t, d.document.id, testDocumentBody(newDoc.text));
    }, "Borrador de prueba creado. Revísalo y publícalo cuando quieras.");
  }
  async function openAcceptances(versionId: string) {
    if (accOpen?.id === versionId) { setAccOpen(null); return; }
    const t = getToken(); if (!t) return;
    setAccOpen({ id: versionId, rows: null });
    try { setAccOpen({ id: versionId, rows: (await centralContractsApi.acceptances(t, versionId)).acceptances.filter((a) => a.organization_id === orgId) }); }
    catch (e) { toast.show(errText(e), "danger"); setAccOpen(null); }
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]" data-testid="central-agency-admin">
      <Select label="Agencia" value={orgId} onChange={(e) => { setOrgId(e.target.value); setRevoking(null); setRetiring(null); setAccOpen(null); setConfirmPublish(null); }} data-testid="central-agency-select">
        <option value="">Elige una agencia…</option>
        {orgs.map((o) => <option key={o.organizationId} value={o.organizationId}>{o.name}{o.status === "trial" ? " (prueba)" : ""}</option>)}
      </Select>
      {!org ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Elige una agencia para ver su interruptor, sus representantes, sus documentos de prueba y su estado.</p>
        : docs === null || sigs === null || switchOn === null ? <Skeleton className="h-64" />
        : <>
          {/* 1. Interruptor por agencia (157) */}
          <Section testId="central-switch" icon={<ToggleLeft size={18} />} title="Interruptor «Contratos»"
            hint="Decide si esta agencia ve sus contratos. Cada cambio pide un motivo y queda en el historial. Apagarlo no borra contratos ni constancias.">
            <div className="flex flex-wrap items-center gap-2">
              <span data-testid="central-switch-state" data-state={switchOn ? "on" : "off"}><Badge tone={switchOn ? "success" : "neutral"}>{switchOn ? "Encendido" : "Apagado"}</Badge></span>
            </div>
            <Input label={switchOn ? "Motivo para apagarlo" : "Motivo para encenderlo"} value={switchReason} onChange={(e) => setSwitchReason(e.target.value)} placeholder={switchOn ? "Fin del ensayo" : "Ensayo de firma ficticio"} data-testid="central-switch-reason" />
            <div><Button variant={switchOn ? "secondary" : "primary"} disabled={busy || switchReason.trim().length < 3} data-testid="central-switch-toggle"
              onClick={() => void run((t) => setOrganizationFeature(orgId, "CONTRACTS", !switchOn, switchReason.trim(), t), switchOn ? "«Contratos» apagado para esta agencia." : "«Contratos» encendido para esta agencia.").then((ok) => ok && setSwitchReason(""))}>
              {switchOn ? "Apagar «Contratos»" : "Encender «Contratos»"}</Button></div>
          </Section>

          {/* 2. Representantes designadas (153) */}
          <Section testId="central-signatories" icon={<UserCheck size={18} />} title="Representantes autorizadas"
            hint="Quién firma por la agencia ante ETNARA. Solo administradoras activas de esta agencia. Revocar pide un motivo y no borra firmas anteriores.">
            {(sigs ?? []).length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Ninguna designada.</p>
              : <ul className="flex flex-col gap-2">{(sigs ?? []).map((s) => (
                <li key={s.id} className="rounded-xl border border-[var(--color-border)] p-3" data-testid="central-signatory" data-state={s.revoked_at ? "revoked" : "active"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.full_name}</span><span className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{s.title}</span>
                    <Badge tone={s.revoked_at ? "neutral" : "success"}>{s.revoked_at ? `Revocada ${contractDate(s.revoked_at)}` : `Designada ${contractDate(s.designated_at)}`}</Badge>
                  </div>
                  <p className="mt-1 text-[var(--text-caption)] text-[var(--color-text-muted)]">Cuenta: {eligible.find((e) => e.userId === s.user_id)?.email ?? "—"} · Fundamento: {s.basis}</p>
                  {!s.revoked_at && (revoking?.id === s.id
                    ? <div className="mt-2 flex flex-col gap-2">
                        <Input label="Motivo de la revocación" value={revoking.reason} onChange={(e) => setRevoking({ id: s.id, reason: e.target.value })} data-testid="central-revoke-reason" />
                        <div className="flex gap-2"><Button size="sm" variant="danger" disabled={busy || revoking.reason.trim().length < 5} data-testid="central-revoke-confirm"
                          onClick={() => void run((t) => centralContractsApi.revoke(t, orgId, s.id, revoking.reason.trim()), "Designación revocada.").then((ok) => ok && setRevoking(null))}>Revocar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setRevoking(null)}>Cancelar</Button></div>
                      </div>
                    : <Button size="sm" variant="secondary" className="mt-2" data-testid="central-revoke" onClick={() => setRevoking({ id: s.id, reason: "" })}>Revocar…</Button>)}
                </li>))}</ul>}
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
              <p className="text-[var(--text-small)] font-semibold">Designar representante</p>
              {eligible.filter((e) => !designatedIds.has(e.userId)).length === 0
                ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay administradoras activas sin designar en esta agencia.</p>
                : <>
                  <Select label="Cuenta (administradora activa)" value={des.userId} onChange={(e) => setDes({ ...des, userId: e.target.value })} data-testid="central-designate-user">
                    <option value="">Elige la cuenta…</option>
                    {eligible.filter((e) => !designatedIds.has(e.userId)).map((e) => <option key={e.userId} value={e.userId}>{e.email}</option>)}
                  </Select>
                  <Input label="Nombre completo" value={des.fullName} onChange={(e) => setDes({ ...des, fullName: e.target.value })} hint="Nombre y apellido, como firmará." data-testid="central-designate-name" />
                  <Input label="Cargo" value={des.title} onChange={(e) => setDes({ ...des, title: e.target.value })} data-testid="central-designate-title" />
                  <Input label="Fundamento" value={des.basis} onChange={(e) => setDes({ ...des, basis: e.target.value })} hint="Ej.: resolución corporativa, formulario de alta o «Designación de ensayo (cuenta de prueba)»." data-testid="central-designate-basis" />
                  <div><Button disabled={busy || !des.userId || !/\S+\s+\S+/.test(des.fullName.trim()) || des.title.trim().length < 2 || des.basis.trim().length < 10} data-testid="central-designate"
                    onClick={() => void run((t) => centralContractsApi.designate(t, orgId, { userId: des.userId, fullName: des.fullName.trim(), title: des.title.trim(), basis: des.basis.trim() }), "Representante designada.").then((ok) => ok && setDes({ userId: "", fullName: "", title: "", basis: "" }))}>
                    Designar</Button></div>
                </>}
            </div>
          </Section>

          {/* 3 y 4. Documentos de prueba de esta agencia: crear, publicar, consultar aceptaciones, retirar */}
          <Section testId="central-test-docs" icon={<FileSignature size={18} />} title="Documentos de prueba de esta agencia"
            hint="Solo los ve esta agencia, y solo con «Contratos» encendido. Firmarlos exige además las firmas de prueba activas en el servidor. Retirar no borra versiones, firmas ni constancias.">
            {generalTestLive.length > 0 && <p className="rounded-[var(--radius-md)] bg-[var(--color-warning-100)] px-3 py-2 text-[var(--text-caption)] text-[var(--color-warning-700)]" data-testid="central-general-test-warning">
              Hay {generalTestLive.length} documento(s) de prueba general(es) vigente(s): los ve toda agencia con «Contratos» encendido.</p>}
            {mine.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Esta agencia no tiene documentos de prueba.</p>
              : <ul className="flex flex-col gap-2">{mine.map((d) => d.versions.map((v) => (
                <li key={v.id} className="rounded-xl border border-[var(--color-border)] p-3" data-testid="central-test-doc" data-state={v.status}>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{d.title}</span><Badge tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Badge></div>
                  <p className="mt-1 text-[var(--text-caption)] text-[var(--color-text-muted)]">{d.code} · versión {v.version_label} · {v.published_at ? `publicada ${contractDate(v.published_at)}` : `creada ${contractDate(v.created_at)}`}{v.retired_at ? ` · retirada ${contractDate(v.retired_at)}` : ""} · {v.acceptances} aceptación(es) · huella {v.content_sha256.slice(0, 12)}…</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {v.status === "draft" && (confirmPublish === v.id
                      ? <><Button size="sm" disabled={busy} data-testid="central-publish-confirm" onClick={() => void run((t) => centralContractsApi.publish(t, v.id), "Documento de prueba publicado para esta agencia.").then(() => setConfirmPublish(null))}>Confirmar publicación</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmPublish(null)}>Cancelar</Button></>
                      : <Button size="sm" data-testid="central-publish" onClick={() => setConfirmPublish(v.id)}>Publicar…</Button>)}
                    {v.status !== "draft" && <Button size="sm" variant="secondary" data-testid="central-acceptances" onClick={() => void openAcceptances(v.id)}>{accOpen?.id === v.id ? "Ocultar aceptaciones" : "Ver aceptaciones"}</Button>}
                    {v.status === "published" && retiring?.id !== v.id && <Button size="sm" variant="secondary" data-testid="central-retire" onClick={() => setRetiring({ id: v.id, reason: "" })}>Retirar…</Button>}
                  </div>
                  {confirmPublish === v.id && <p className="mt-2 text-[var(--text-caption)] text-[var(--color-text-secondary)]">Al publicarlo queda fijo (no se puede editar) y visible para esta agencia si tiene «Contratos» encendido.</p>}
                  {retiring?.id === v.id && <div className="mt-2 flex flex-col gap-2">
                    <Input label="Motivo del retiro" value={retiring.reason} onChange={(e) => setRetiring({ id: v.id, reason: e.target.value })} placeholder="Fin del ensayo de firma" data-testid="central-retire-reason" />
                    <div className="flex gap-2"><Button size="sm" variant="danger" disabled={busy || retiring.reason.trim().length < 5} data-testid="central-retire-confirm"
                      onClick={() => void run((t) => centralContractsApi.retire(t, v.id, retiring.reason.trim()), "Documento retirado. Las firmas y constancias se conservan.").then((ok) => ok && setRetiring(null))}>Retirar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setRetiring(null)}>Cancelar</Button></div>
                  </div>}
                  {accOpen?.id === v.id && (accOpen.rows === null ? <Skeleton className="mt-2 h-12" />
                    : accOpen.rows.length === 0 ? <p className="mt-2 text-[var(--text-small)] text-[var(--color-text-muted)]">Sin aceptaciones.</p>
                    : <ul className="mt-2 flex flex-col gap-1" data-testid="central-acceptance-list">{accOpen.rows.map((a) => (
                      <li key={a.accepted_at} className="text-[var(--text-small)]" data-testid="central-acceptance">{a.signer_full_name} ({a.signer_title}) · {a.accepted_by_login} · {contractDate(a.accepted_at)} · código por correo{a.is_test ? " · prueba" : ""}</li>))}</ul>)}
                </li>)))}</ul>}
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
              <p className="text-[var(--text-small)] font-semibold">Nuevo documento de prueba</p>
              <Input label="Título" value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} hint={`Se guardará como «${testDocumentTitle(newDoc.title || "…")}».`} data-testid="central-new-title" />
              <Textarea label="Texto" value={newDoc.text} onChange={(e) => setNewDoc({ ...newDoc, text: e.target.value })} rows={5} hint={`Siempre empieza con: «${TEST_BANNER}»`} data-testid="central-new-text" />
              <div><Button variant="secondary" disabled={busy || newDoc.title.trim().length < 3 || newDoc.text.trim().length < 20} data-testid="central-create-doc" onClick={() => void createDoc()}>Crear borrador de prueba</Button></div>
            </div>
          </Section>

          {/* Estado actual de la agencia frente a lo vigente */}
          <Section testId="central-agency-status" icon={<ShieldCheck size={18} />} title="Estado de esta agencia" hint="Documentos vigentes que le aplican y si ya los aceptó.">
            {org.contracts.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No le aplica ningún documento vigente.</p>
              : <ul className="flex flex-col gap-1.5">{org.contracts.map((c) => {
                const doc = overview.documents.find((d) => d.versionId === c.versionId); const st = acceptanceLabel(c.state);
                return <li key={c.versionId} className="flex flex-wrap items-center gap-2 text-[var(--text-small)]" data-testid="central-agency-status-row" data-state={c.state}>
                  <span>{doc?.title} · {doc?.versionLabel}</span><Badge tone={st.tone}>{st.label}</Badge>
                  {c.accepted && <span className="text-[var(--color-text-secondary)]">{c.accepted.signerFullName} · {contractDate(c.accepted.acceptedAt)}</span>}
                </li>;
              })}</ul>}
          </Section>
        </>}
    </div>
  );
}
