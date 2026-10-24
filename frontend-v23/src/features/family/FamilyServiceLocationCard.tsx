import { useCallback, useEffect, useState } from "react";
import { MapPin, Send } from "lucide-react";
import type { ApiError } from "@/api/client";
import { getToken } from "@/auth/token";
import { createChangeRequest, getFamilyServiceLocation, listMyChangeRequests, type ChangeRequest, type FamilyServiceLocation } from "@/api/serviceLocations";
import { Badge, Button, Card, Input, Modal, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { PUERTO_RICO_MUNICIPALITIES } from "@/features/smartmatch/municipalities";

const STATUS: Record<ChangeRequest["status"], { label: string; tone: "warning" | "success" | "neutral" }> = {
  PENDING: { label: "En revisión", tone: "warning" },
  APPROVED: { label: "Aplicada por la agencia", tone: "success" },
  REJECTED: { label: "Revisada · sin cambios", tone: "neutral" },
};
const day = (v: string) => new Date(v).toLocaleDateString("es-PR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Puerto_Rico" });

/**
 * Family Portal · Lugar del servicio (Gate 6). The relative sees the official
 * address only when the agency allowed it, and can ask for a correction; the
 * agency approves or rejects. The family never edits the address.
 */
export function FamilyServiceLocationCard({ recipientId }: { recipientId: string }) {
  const { show } = useToast();
  const [data, setData] = useState<FamilyServiceLocation | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ addressLine: "", municipality: "", postalCode: "", accessNotes: "", message: "" });
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [loc, reqs] = await Promise.all([getFamilyServiceLocation(recipientId, token), listMyChangeRequests(recipientId, token)]);
      setData(loc); setRequests(reqs);
    } catch { setData({ canView: false, location: null }); }
  }, [recipientId]);
  useEffect(() => { void load(); }, [load]);

  const pending = requests.find((r) => r.status === "PENDING");

  async function submit() {
    const token = getToken();
    if (!token) return;
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)) as Record<string, string>;
    if (!Object.keys(body).length) { setFormError("Escribe la corrección o un mensaje para la agencia."); return; }
    if (body.postalCode && !/^\d{5}(-\d{4})?$/.test(body.postalCode)) { setFormError("El código postal debe tener 5 dígitos."); return; }
    setBusy(true); setFormError("");
    try {
      await createChangeRequest(recipientId, body, token);
      show("Solicitud enviada. La agencia la revisará y te avisaremos.", "success");
      setOpen(false); setForm({ addressLine: "", municipality: "", postalCode: "", accessNotes: "", message: "" });
    } catch (e) {
      setFormError((e as ApiError)?.status === 409 ? "Ya tienes una solicitud en revisión." : "No se pudo enviar la solicitud.");
    } finally { setBusy(false); await load(); }
  }

  const address = data?.location ? (data.location.establishment
    ? [data.location.establishment.name, data.location.establishment.address].filter(Boolean).join(", ")
    : [data.location.addressLine, [data.location.municipality, data.location.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ")) : "";

  return (
    <section>
      <h2 className="mb-3 font-display text-xl text-[#102b57]">Lugar del servicio</h2>
      <Card className="rounded-[22px] border-[#102b57]/10 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
        {data === null ? <Skeleton className="h-16" /> : <>
          <div className="flex items-start gap-3">
            <MapPin size={20} className="mt-0.5 shrink-0 text-[#66845f]" aria-hidden />
            <div className="min-w-0">
              {data.canView && data.location ? <>
                <p className="font-medium text-[#173154]">{data.location.label}</p>
                <p className="text-sm text-[#475467]">{address || "Ubicación marcada por la agencia"}</p>
                {data.location.verified && <p className="mt-1 text-xs text-[#66845f]">Verificada por la agencia</p>}
              </> : <p className="text-sm text-[#667085]">{data.canView ? "La agencia aún no ha registrado la dirección." : "La agencia mantiene la dirección del servicio. Si ves un error, puedes pedir una corrección."}</p>}
            </div>
          </div>
          {requests.length > 0 && <ul className="mt-4 space-y-2 border-t border-[#102b57]/10 pt-3">
            {requests.slice(0, 3).map((r) => (
              <li key={r.id} className="text-sm">
                <div className="flex items-center justify-between gap-2"><span className="text-[#173154]">Corrección del {day(r.created_at)}</span><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></div>
                {r.resolution_note && <p className="mt-0.5 text-xs text-[#667085]">Agencia: {r.resolution_note}</p>}
              </li>
            ))}
          </ul>}
          <Button variant="secondary" className="mt-4 w-full" icon={<Send size={16} />} disabled={Boolean(pending)} onClick={() => { setFormError(""); setOpen(true); }}>
            {pending ? "Corrección en revisión" : "Solicitar una corrección"}
          </Button>
        </>}
      </Card>

      {/* Same mobile pattern as the agency address forms: full-screen sheet, compact one-row footer. */}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Solicitar corrección" fullScreenOnMobile
        footer={<div className="flex w-full items-center gap-2 sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className="flex-1 sm:flex-none" loading={busy} onClick={() => void submit()}>Enviar a la agencia</Button>
        </div>}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#475467]">La agencia revisará tu solicitud antes de cambiar la dirección oficial. Completa solo lo que haya que corregir.</p>
          <Input label="Dirección correcta" maxLength={200} value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} autoComplete="off" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Municipio" value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })}>
              <option value="">Sin cambio</option>
              {PUERTO_RICO_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input label="Código postal" inputMode="numeric" maxLength={10} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </div>
          <Textarea label="Cómo llegar / acceso" rows={2} maxLength={500} value={form.accessNotes} onChange={(e) => setForm({ ...form, accessNotes: e.target.value })} />
          <Textarea label="Mensaje para la agencia" rows={2} maxLength={500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          {formError && <p role="alert" className="text-sm text-[var(--color-danger-700)]">{formError}</p>}
        </div>
      </Modal>
    </section>
  );
}
