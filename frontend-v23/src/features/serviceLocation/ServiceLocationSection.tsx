import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Crosshair, History, MapPin, Plus, ShieldCheck } from "lucide-react";
import type { ApiError } from "@/api/client";
import { getToken } from "@/auth/token";
import {
  archiveLocation, createServiceLocation, listChangeRequests, listFamilyPermissions, listServiceLocations, locationHistory,
  reassignShifts, resolveChangeRequest, setFamilyPermission, setPrimaryLocation, updateServiceLocation, verifyLocation,
  type ChangeRequest, type FamilyPermission, type LocationAccess, type LocationEvent, type ServiceLocation, type ServiceLocationsResponse,
} from "@/api/serviceLocations";
import { Badge, Button, Card, Checkbox, Input, Modal, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { PUERTO_RICO_MUNICIPALITIES } from "@/features/smartmatch/municipalities";
import { GpsConfirmModal } from "./GpsConfirmModal";
import { serviceAddressText } from "./navigation";

const when = (v: string) => new Date(v).toLocaleString("es-PR", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" });
const day = (v: string) => new Date(v).toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Puerto_Rico" });
const EVENT_LABEL: Record<LocationEvent["event_type"], string> = {
  CREATED: "Dirección registrada", UPDATED: "Dirección modificada", VERIFIED: "Dirección verificada",
  PRIMARY_SET: "Marcada como principal", ARCHIVED: "Dirección archivada", RESTORED: "Dirección restaurada",
  GPS_CONFIRMED: "Punto GPS confirmado", GPS_CHANGED: "Marcador movido (GPS por confirmar)",
};
const ERRORS: Record<string, string> = {
  PRIMARY_CANNOT_BE_ARCHIVED: "Marca otra dirección como principal antes de archivar esta.",
  LOCATION_IN_USE_BY_UPCOMING_SHIFTS: "Hay turnos próximos con esta dirección. Muévelos primero a otra dirección.",
  LOCATION_ARCHIVED: "Esta dirección está archivada.",
  REQUEST_ALREADY_RESOLVED: "Esta solicitud ya fue atendida.",
  INVALID_PAYLOAD: "Revisa los datos: municipio de Puerto Rico y código postal de 5 dígitos.",
};
const message = (e: unknown, fallback: string) => ERRORS[(e as ApiError)?.code ?? ""] ?? fallback;

interface FormState {
  id: string | null; label: string; useEstablishment: boolean; addressLine: string; municipality: string; postalCode: string;
  accessNotes: string; makePrimary: boolean;
}
const emptyForm = (primary: boolean): FormState => ({ id: null, label: primary ? "Principal" : "Alterna", useEstablishment: false,
  addressLine: "", municipality: "", postalCode: "", accessNotes: "", makePrimary: primary });

/**
 * Pacientes/Residentes → Expediente → Ubicación del servicio (Gate 6).
 * Only agency managers reach these endpoints; the server and RLS enforce it.
 */
export function ServiceLocationSection({ organizationId, recipientId }: { organizationId: string; recipientId: string }) {
  const { show } = useToast();
  const [data, setData] = useState<ServiceLocationsResponse | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [relatives, setRelatives] = useState<FamilyPermission[]>([]);
  const [error, setError] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState<number | null>(null);
  const [moveOffer, setMoveOffer] = useState<{ toLocationId: string; shiftIds: string[] } | null>(null);
  const [history, setHistory] = useState<{ events: LocationEvent[]; access: LocationAccess[] } | null>(null);
  const [resolving, setResolving] = useState<{ request: ChangeRequest; decision: "APPROVE" | "REJECT" } | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [shiftsAck, setShiftsAck] = useState(false);
  // Gate 6 fix: exact point confirmed separately from the written address.
  const [gpsFor, setGpsFor] = useState<ServiceLocation | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [locations, reqs, rels] = await Promise.all([
        listServiceLocations(organizationId, recipientId, token),
        listChangeRequests(organizationId, recipientId, token),
        listFamilyPermissions(organizationId, recipientId, token),
      ]);
      setData(locations); setRequests(reqs); setRelatives(rels); setError(false);
    } catch { setError(true); }
  }, [organizationId, recipientId]);
  useEffect(() => { void load(); }, [load]);

  const active = (data?.locations ?? []).filter((l) => !l.archivedAt);
  const primaryLocation = active.find((l) => l.isPrimary) ?? null;
  const approvalShifts = primaryLocation?.upcomingShiftCount ?? 0;
  const archived = (data?.locations ?? []).filter((l) => l.archivedAt);
  const labelOf = (id: string | null) => data?.locations.find((l) => l.id === id)?.label ?? "Sin dirección";

  function openEdit(l: ServiceLocation) {
    setFormError("");
    setForm({ id: l.id, label: l.label, useEstablishment: Boolean(l.establishment), addressLine: l.addressLine ?? "",
      municipality: l.municipality ?? "", postalCode: l.postalCode ?? "", accessNotes: l.accessNotes ?? "",
      makePrimary: l.isPrimary });
  }

  async function save(confirmed = false) {
    const token = getToken();
    if (!form || !token) return;
    if (!form.useEstablishment && !form.addressLine.trim()) { setFormError("Escribe la dirección física."); return; }
    if (form.postalCode && !/^\d{5}(-\d{4})?$/.test(form.postalCode.trim())) { setFormError("El código postal debe tener 5 dígitos (ej. 00725)."); return; }
    const current = form.id ? data?.locations.find((l) => l.id === form.id) : undefined;
    if (form.id && !confirmed && (current?.upcomingShiftCount ?? 0) > 0) { setConfirmEdit(current!.upcomingShiftCount!); return; }
    const input = {
      label: form.label.trim() || "Principal",
      establishmentId: form.useEstablishment ? data?.establishment?.id ?? null : null,
      addressLine: form.useEstablishment ? null : form.addressLine.trim() || null,
      municipality: form.useEstablishment ? null : form.municipality || null,
      postalCode: form.useEstablishment ? null : form.postalCode.trim() || null,
      accessNotes: form.accessNotes.trim() || null,
    };
    setBusy(true); setFormError("");
    try {
      if (form.id) {
        await updateServiceLocation(organizationId, recipientId, form.id, input, token);
        show("Dirección actualizada. Vuelve a verificarla.", "success");
      } else {
        const r = await createServiceLocation(organizationId, recipientId, { ...input, makePrimary: form.makePrimary }, token);
        show("Dirección registrada. Ahora ubica el punto exacto en el mapa.", "success");
        setGpsFor(r.location);
        if (r.shiftsOnOtherAddresses.length) setMoveOffer({ toLocationId: r.location.id, shiftIds: r.shiftsOnOtherAddresses });
      }
      setForm(null); setConfirmEdit(null);
    } catch (e) { setFormError(message(e, "No se pudo guardar la dirección.")); }
    finally { setBusy(false); await load(); }
  }

  async function act(fn: (token: string) => Promise<unknown>, ok: string, fail: string) {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try { await fn(token); show(ok, "success"); }
    catch (e) { show(message(e, fail), "danger"); }
    finally { setBusy(false); await load(); }
  }

  async function makePrimary(l: ServiceLocation) {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try {
      const r = await setPrimaryLocation(organizationId, recipientId, l.id, token);
      show(`«${l.label}» es ahora la dirección principal.`, "success");
      if (r.shiftsOnOtherAddresses.length) setMoveOffer({ toLocationId: l.id, shiftIds: r.shiftsOnOtherAddresses });
    } catch (e) { show(message(e, "No se pudo cambiar la dirección principal."), "danger"); }
    finally { setBusy(false); await load(); }
  }

  /** Optimistic: the box reflects the choice at once and reverts if the server refuses. */
  async function togglePermission(r: FamilyPermission, canView: boolean) {
    const token = getToken();
    if (!token) return;
    setRelatives((list) => list.map((x) => (x.id === r.id ? { ...x, can_view_service_location: canView } : x)));
    try {
      await setFamilyPermission(organizationId, recipientId, r.id, canView, token);
      show(canView ? "El familiar podrá ver la dirección principal." : "Permiso retirado.", "success");
    } catch {
      setRelatives((list) => list.map((x) => (x.id === r.id ? { ...x, can_view_service_location: !canView } : x)));
      show("No se pudo cambiar el permiso.", "danger");
    }
  }

  async function openHistory() {
    const token = getToken();
    if (!token) return;
    try { setHistory(await locationHistory(organizationId, recipientId, token)); }
    catch { show("No se pudo cargar el historial.", "danger"); }
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const moveShifts = (data?.upcomingShifts ?? []).filter((s) => moveOffer?.shiftIds.includes(s.id));

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={21} aria-hidden />
          <div>
            <h2 className="font-medium text-[var(--color-text-primary)]">Ubicación del servicio</h2>
            <p className="mt-0.5 flex items-center gap-1 text-[var(--text-caption)] text-[var(--color-text-muted)]"><ShieldCheck size={13} aria-hidden />
              Solo tu agencia. La cuidadora la ve durante su turno asignado; la familia, solo si la autorizas.</p>
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="ghost" icon={<History size={16} />} onClick={() => void openHistory()} className="flex-1 sm:flex-none">Historial</Button>
          <Button icon={<Plus size={16} />} onClick={() => { setFormError(""); setForm(emptyForm(active.length === 0)); }} className="flex-1 sm:flex-none">Añadir</Button>
        </div>
      </div>

      {error && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">No se pudo cargar la ubicación.</p>}
      {!data && !error && <Skeleton className="h-24" />}

      {pending.map((r) => (
        <div key={r.id} role="status" className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-warning-700)]/40 bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)]">
          <p className="font-medium">Corrección solicitada por un familiar ({r.relationship_type}) · {day(r.created_at)}</p>
          <ul className="mt-1 space-y-0.5 text-[var(--color-text-secondary)]">
            {r.proposed_address_line && <li>Dirección: <strong className="text-[var(--color-text-primary)]">{r.proposed_address_line}</strong></li>}
            {r.proposed_municipality && <li>Municipio: {r.proposed_municipality}</li>}
            {r.proposed_postal_code && <li>Código postal: {r.proposed_postal_code}</li>}
            {r.proposed_access_notes && <li>Acceso: {r.proposed_access_notes}</li>}
            {r.message && <li>Mensaje: «{r.message}»</li>}
          </ul>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button size="md" onClick={() => { setResolutionNote(""); setShiftsAck(false); setResolving({ request: r, decision: "APPROVE" }); }}>Aprobar y aplicar</Button>
            <Button size="md" variant="secondary" onClick={() => { setResolutionNote(""); setResolving({ request: r, decision: "REJECT" }); }}>Rechazar</Button>
          </div>
        </div>
      ))}

      {data && active.length === 0 && (
        <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Sin dirección registrada. Añádela para que la cuidadora pueda abrir el mapa desde su turno.</p>
      )}
      <ul className="space-y-3">
        {active.map((l) => (
          <li key={l.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3" data-testid="service-location">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-[var(--color-text-primary)]">{l.label}</p>
              {l.isPrimary && l.label !== "Principal" && <Badge tone="accent">Principal</Badge>}
              {l.verifiedAt ? <Badge tone="success">Dirección verificada</Badge> : <Badge tone="warning">Dirección sin verificar</Badge>}
              {l.gpsConfirmedAt ? <Badge tone="success">GPS confirmado</Badge> : <Badge tone="warning">GPS sin confirmar</Badge>}
            </div>
            <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-primary)]">{serviceAddressText(l) || "Ubicación marcada en el mapa"}</p>
            {l.establishment && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Dirección del hogar (no se copia al expediente).</p>}
            {l.accessNotes && <p className="mt-1 whitespace-pre-line text-[var(--text-small)] text-[var(--color-text-secondary)]">Acceso: {l.accessNotes}</p>}
            <p className="mt-1 text-[var(--text-caption)] text-[var(--color-text-muted)]">
              {l.gpsConfirmedAt ? "Punto exacto confirmado: la navegación llega al marcador."
                : l.latitude != null ? "Marcador sin confirmar: la navegación usará la dirección escrita (aproximada)."
                : "Sin marcador: la navegación usará la dirección escrita (aproximada)."} · {l.upcomingShiftCount ?? 0} turno(s) próximo(s)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="md" variant="secondary" disabled={busy} onClick={() => openEdit(l)}>Editar</Button>
              <Button size="md" variant={l.gpsConfirmedAt ? "secondary" : "primary"} icon={<Crosshair size={16} />} disabled={busy} onClick={() => setGpsFor(l)}>
                {l.gpsConfirmedAt ? "Corregir punto" : "Ubicar en el mapa"}</Button>
              {!l.verifiedAt && <Button size="md" variant="secondary" icon={<CheckCircle2 size={16} />} disabled={busy}
                onClick={() => void act((t) => verifyLocation(organizationId, recipientId, l.id, t), "Dirección escrita verificada.", "No se pudo verificar.")}>Verificar dirección</Button>}
              {!l.isPrimary && <Button size="md" variant="ghost" disabled={busy} onClick={() => void makePrimary(l)}>Hacer principal</Button>}
              {!l.isPrimary && <Button size="md" variant="ghost" disabled={busy}
                onClick={() => void act((t) => archiveLocation(organizationId, recipientId, l.id, t), "Dirección archivada.", "No se pudo archivar.")}>Archivar</Button>}
            </div>
          </li>
        ))}
      </ul>
      {archived.length > 0 && <p className="mt-2 text-[var(--text-caption)] text-[var(--color-text-muted)]">{archived.length} dirección(es) archivada(s) en el historial.</p>}

      {relatives.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
          <p className="text-[var(--text-small)] font-medium">Familiares que pueden ver la dirección principal</p>
          <ul className="mt-2 space-y-1">
            {relatives.map((r) => (
              <li key={r.id}>
                <Checkbox label={`${r.relationship_type}${r.is_primary_contact ? " (contacto principal)" : ""}`} checked={r.can_view_service_location} disabled={busy}
                  onChange={(e) => void togglePermission(r, e.target.checked)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <GpsConfirmModal open={gpsFor !== null} organizationId={organizationId} recipientId={recipientId} location={gpsFor}
        onClose={() => setGpsFor(null)} onConfirmed={() => { setGpsFor(null); void load(); }} />

      <Modal open={form !== null} onClose={() => !busy && setForm(null)} title={form?.id ? "Editar dirección" : "Añadir dirección"} fullScreenOnMobile
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => setForm(null)}>Cancelar</Button>
          <Button loading={busy} onClick={() => void save()}>Guardar</Button>
        </div>}>
        {form && <div className="flex flex-col gap-3">
          <Input label="Nombre de la dirección" maxLength={40} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} hint="Ej. Casa, Casa de la hija, Hogar." />
          {data?.establishment && <Checkbox label={`Usar la dirección del hogar «${data.establishment.name}»`} checked={form.useEstablishment}
            onChange={(e) => setForm({ ...form, useEstablishment: e.target.checked })} />}
          {!form.useEstablishment && <>
            <Input label="Dirección física" maxLength={200} value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} placeholder="Ej. Calle Luna 12, Urb. Las Flores" autoComplete="off" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Municipio" value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })}>
                <option value="">Selecciona</option>
                {PUERTO_RICO_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Input label="Código postal" inputMode="numeric" maxLength={10} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="00725" />
            </div>
          </>}
          <Textarea label="Referencias de acceso" rows={3} maxLength={500} value={form.accessNotes} onChange={(e) => setForm({ ...form, accessNotes: e.target.value })}
            placeholder="Portón, timbre, dónde estacionar, mascotas…" />
          <p className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)] text-[var(--color-text-secondary)]">
            El punto exacto se confirma en el siguiente paso, «Ubicar en el mapa». Sin él, la navegación usa la dirección escrita y puede ser aproximada.</p>
          {!form.id && active.length > 0 && <Checkbox label="Marcar como dirección principal" checked={form.makePrimary} onChange={(e) => setForm({ ...form, makePrimary: e.target.checked })} />}
          {formError && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{formError}</p>}
        </div>}
      </Modal>

      <Modal open={confirmEdit !== null} onClose={() => setConfirmEdit(null)} title="Esta dirección está en uso"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirmEdit(null)}>Volver</Button>
          <Button loading={busy} onClick={() => void save(true)}>Guardar corrección</Button>
        </div>}>
        <p className="text-[var(--text-small)]">{confirmEdit} turno(s) próximo(s) usan esta dirección y verán la corrección. Si el paciente <strong>se mudó</strong>, añade una dirección nueva y marca «principal»; así decides qué turnos mover.</p>
      </Modal>

      <Modal open={moveOffer !== null} onClose={() => setMoveOffer(null)} title="Turnos próximos con otra dirección"
        footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setMoveOffer(null)}>Mantener como están</Button>
          <Button loading={busy} onClick={() => moveOffer && void act(async (t) => { await reassignShifts(organizationId, recipientId, moveOffer.shiftIds, moveOffer.toLocationId, t); setMoveOffer(null); },
            "Turnos actualizados. Avisamos a las cuidadoras asignadas.", "No se pudieron actualizar los turnos.")}>Actualizar {moveOffer?.shiftIds.length} turno(s)</Button>
        </div>}>
        <p className="text-[var(--text-small)]">Estos turnos siguen con su dirección anterior. Actualízalos solo si el servicio será en la dirección nueva. El cambio queda registrado.</p>
        <ul className="mt-2 space-y-1 text-[var(--text-small)]">
          {moveShifts.map((s) => <li key={s.id}>{day(s.scheduledStart)} · ahora: {labelOf(s.locationId)}</li>)}
        </ul>
      </Modal>

      <Modal open={resolving !== null} onClose={() => !busy && setResolving(null)} title={resolving?.decision === "APPROVE" ? "Aprobar corrección" : "Rechazar corrección"}
        fullScreenOnMobile
        footer={<div className="flex w-full items-center gap-2 sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => setResolving(null)}>Volver</Button>
          <Button className="flex-1 sm:flex-none" loading={busy} variant={resolving?.decision === "REJECT" ? "danger" : "primary"}
            disabled={resolving?.decision === "APPROVE" && approvalShifts > 0 && !shiftsAck}
            onClick={() => resolving && void act(async (t) => { await resolveChangeRequest(organizationId, recipientId, resolving.request.id,
              { decision: resolving.decision, ...(resolutionNote.trim() ? { note: resolutionNote.trim() } : {}),
                ...(resolving.decision === "APPROVE" && shiftsAck ? { confirmUpcomingShifts: true as const } : {}) }, t); setResolving(null); },
              resolving.decision === "APPROVE"
                ? (approvalShifts > 0 ? "Corrección aplicada. Avisamos al familiar y a la cuidadora de los turnos próximos." : "Corrección aplicada a la dirección principal. Avisamos al familiar.")
                : "Solicitud rechazada. Avisamos al familiar.",
              "No se pudo registrar la decisión.")}>Confirmar</Button>
        </div>}>
        {resolving?.decision === "APPROVE" ? <div className="flex flex-col gap-3 text-[var(--text-small)]">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3" data-testid="approval-diff">
            <p className="text-[var(--color-text-secondary)]">Ahora: <span className="text-[var(--color-text-primary)]">{primaryLocation ? serviceAddressText(primaryLocation) || "—" : "—"}</span></p>
            <p className="mt-1 text-[var(--color-text-secondary)]">Propuesta: <strong className="text-[var(--color-text-primary)]">{[resolving.request.proposed_address_line, [resolving.request.proposed_municipality, resolving.request.proposed_postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "sin cambios en la dirección"}</strong></p>
            {resolving.request.proposed_access_notes && <p className="mt-1 text-[var(--color-text-secondary)]">Acceso: {resolving.request.proposed_access_notes}</p>}
          </div>
          <p>Se aplicará a la dirección principal. Tendrás que verificarla de nuevo y, si cambia la calle o el municipio, confirmar otra vez el punto GPS.</p>
          {approvalShifts > 0 && <div role="status" className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--color-warning-700)]">
            <p>{approvalShifts} turno(s) próximo(s) usan esta dirección. Los turnos no se modifican, pero la cuidadora asignada verá la dirección corregida y recibirá un aviso (sin la dirección).</p>
            <div className="mt-2"><Checkbox label={`Autorizo que ${approvalShifts === 1 ? "ese turno use" : "esos turnos usen"} la dirección corregida`} checked={shiftsAck} onChange={(e) => setShiftsAck(e.target.checked)} /></div>
          </div>}
        </div> : <p className="text-[var(--text-small)]">La dirección oficial no cambia.</p>}
        <div className="mt-3"><Textarea label="Nota para el familiar (opcional)" rows={2} maxLength={300} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} /></div>
      </Modal>

      <Modal open={history !== null} onClose={() => setHistory(null)} title="Historial de la ubicación">
        <ol className="space-y-2 text-[var(--text-small)]">
          {(history?.events ?? []).map((e) => (
            <li key={e.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2">
              <p className="font-medium">{EVENT_LABEL[e.event_type]} · {String(e.current.label ?? "")}</p>
              <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{when(e.occurred_at)}</p>
              {e.event_type === "UPDATED" && e.previous && <p className="mt-1 text-[var(--text-caption)]">Antes: {String(e.previous.address_line ?? "—")} · Ahora: {String(e.current.address_line ?? "—")}</p>}
            </li>
          ))}
        </ol>
        {(history?.access ?? []).length > 0 && <>
          <p className="mt-4 text-[var(--text-small)] font-medium">Accesos de cuidadoras</p>
          <ul className="mt-1 space-y-1 text-[var(--text-caption)] text-[var(--color-text-secondary)]">
            {history!.access.map((a, i) => <li key={i}>{a.display_name ?? "Cuidadora"} abrió «{labelOf(a.location_id)}» · {when(a.first_access_at)}</li>)}
          </ul>
        </>}
      </Modal>
    </Card>
  );
}
