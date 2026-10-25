import { useCallback, useEffect, useState } from "react";
import { Link2, Plus, UserRound } from "lucide-react";
import { getToken } from "@/auth/token";
import { financeApi, type BillingClient } from "@/api/finance";
import { listCareRecipients, recipientName, type CareRecipient } from "@/api/shifts";
import { Badge, Button, Checkbox, EmptyState, ErrorState, Input, Modal, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { financeErrorText } from "./money";

/** Pagadores privados (familiar u otra persona responsable), vinculados a sus residentes. */
export function ClientsTab({ organizationId }: { organizationId: string }) {
  const toast = useToast();
  const [clients, setClients] = useState<BillingClient[] | null>(null);
  const [recipients, setRecipients] = useState<CareRecipient[]>([]);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState<BillingClient | null>(null);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try {
      const [c, r] = await Promise.all([financeApi.listClients(organizationId, token), listCareRecipients(organizationId, token)]);
      setClients(c.clients); setRecipients(r); setFailed(false);
    } catch { setFailed(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(c: BillingClient) {
    const token = getToken(); if (!token) return;
    try { await financeApi.updateClient(organizationId, c.id, { active: !c.active }, token); await load(); }
    catch (e) { toast.show(financeErrorText(e), "danger"); }
  }

  if (failed) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!clients) return <div className="flex flex-col gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <section className="flex flex-col gap-3" aria-label="Clientes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-secondary)]">Personas que pagan los servicios. Un precio especial por cliente se configura dentro de cada servicio.</p>
        <Button icon={<Plus size={18} />} onClick={() => setCreating(true)}>Añadir cliente</Button>
      </div>
      {clients.length === 0 ? (
        <EmptyState icon={<UserRound size={28} />} title="Aún no hay clientes" description="Añade a la persona responsable del pago y vincúlala con su residente." />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {clients.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{c.full_name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{[c.email, c.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
                </div>
                {!c.active && <Badge>Inactivo</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.recipients.length === 0 ? <span className="text-xs text-[var(--color-text-muted)]">Sin residentes vinculados</span>
                  : c.recipients.map((r) => <Badge key={r.careRecipientId} tone={r.isPrimary ? "accent" : "neutral"}>{r.name}{r.isPrimary ? " · principal" : ""}</Badge>)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={<Link2 size={16} />} onClick={() => setLinking(c)}>Vincular residente</Button>
                <Button size="sm" variant="ghost" onClick={() => void toggle(c)}>{c.active ? "Desactivar" : "Activar"}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <CreateClientModal open={creating} organizationId={organizationId} onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); }} />
      {linking && <LinkRecipientModal organizationId={organizationId} client={linking} recipients={recipients} onClose={() => setLinking(null)} onSaved={async () => { setLinking(null); await load(); }} />}
    </section>
  );
}

function CreateClientModal({ open, organizationId, onClose, onSaved }: { open: boolean; organizationId: string; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setFullName(""); setEmail(""); setPhone(""); setAddress(""); } }, [open]);
  async function save() {
    const token = getToken(); if (!token) return;
    setSaving(true);
    try { await financeApi.createClient(organizationId, { fullName: fullName.trim(), email: email.trim() || null, phone: phone.trim() || null, address: address.trim() || null }, token); toast.show("Cliente añadido.", "success"); await onSaved(); }
    catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Nuevo cliente" sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} disabled={fullName.trim().length < 2} onClick={() => void save()}>Guardar</Button></>}>
      <div className="flex flex-col gap-4">
        <Input label="Nombre completo" required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Correo electrónico" type="email" inputMode="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Teléfono" type="tel" inputMode="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Textarea label="Dirección postal" rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
    </Modal>
  );
}

function LinkRecipientModal({ organizationId, client, recipients, onClose, onSaved }: { organizationId: string; client: BillingClient; recipients: CareRecipient[]; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const toast = useToast();
  const [recipientId, setRecipientId] = useState("");
  const [primary, setPrimary] = useState(true);
  const [saving, setSaving] = useState(false);
  async function save() {
    const token = getToken(); if (!token || !recipientId) return;
    setSaving(true);
    try { await financeApi.linkRecipient(organizationId, client.id, { careRecipientId: recipientId, isPrimary: primary }, token); toast.show("Residente vinculado.", "success"); await onSaved(); }
    catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Vincular a ${client.full_name}`} sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} disabled={!recipientId} onClick={() => void save()}>Vincular</Button></>}>
      <div className="flex flex-col gap-4">
        <Select label="Residente" required value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
          <option value="">Elige un residente</option>
          {recipients.map((r) => <option key={r.id} value={r.id}>{recipientName(r)}</option>)}
        </Select>
        <Checkbox label="Pagador principal de este residente" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />
        <p className="text-xs text-[var(--color-text-muted)]">Si el residente ya tenía un pagador principal, pasará a ser secundario.</p>
      </div>
    </Modal>
  );
}
