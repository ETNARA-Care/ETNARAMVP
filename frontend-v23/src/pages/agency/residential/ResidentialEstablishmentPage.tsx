import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Badge, Button, Card, ErrorState, Input, Modal, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import {
  residentialApi, residentialErrorMessage, type ResidentialEstablishmentDetail, type ResidentialEstablishmentSummary,
  type ResidentialGeofenceEvent, type ResidentialPerson, type ResidentialPlacementEvent, type ResidentialRoom, type ResidentialUnit,
} from "@/api/residential";
import { isResidentialOrganization, RESIDENTIAL_ESTABLISHMENTS_PATH } from "@/features/residential/modality";
import { BEDS_DISCLAIMER, OccupancySummary } from "./OccupancySummary";

type Dialog =
  | { kind: "unit"; unit?: ResidentialUnit }
  | { kind: "room"; unit: ResidentialUnit; room?: ResidentialRoom }
  | { kind: "place"; person: ResidentialPerson; currentRoomId: string | null }
  | { kind: "history"; person: ResidentialPerson }
  | { kind: "geofence" }
  | { kind: "close" };

/**
 * 171 (hogares F1): un establecimiento del hogar. Unidades (con «General»), habitaciones, camas registradas,
 * ocupación, ubicación y traslado de residentes con historial, geocerca auditada y cierre.
 * Solo administración del hogar; el backend aplica todas las reglas y nunca envía las piezas internas (171).
 */
export function ResidentialEstablishmentPage() {
  const { establishmentId = "" } = useParams();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? "";
  const residential = isResidentialOrganization(activeOrganization);
  const toast = useToast();
  const [data, setData] = useState<ResidentialEstablishmentDetail | null>(null);
  const [all, setAll] = useState<ResidentialEstablishmentSummary[]>([]);
  const [error, setError] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential) return;
    setError(false);
    try {
      const [detail, list] = await Promise.all([
        residentialApi.getEstablishment(organizationId, establishmentId, token),
        residentialApi.listEstablishments(organizationId, token),
      ]);
      setData(detail.establishment); setAll(list.establishments);
    } catch { setError(true); }
  }, [organizationId, establishmentId, residential]);
  useEffect(() => { void load(); }, [load]);

  /** Ejecuta un cambio, avisa y vuelve a leer del servidor (fuente de verdad). */
  const run = async (fn: (token: string) => Promise<unknown>, ok: string): Promise<boolean> => {
    const token = getToken(); if (!token) return false;
    try { await fn(token); toast.show(ok, "success"); setDialog(null); await load(); return true; }
    catch (e) { toast.show(residentialErrorMessage(e), "danger"); return false; }
  };

  if (!residential) return <Navigate to="/agency" replace />;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!data) return <Skeleton className="h-64" />;
  const closed = data.establishment.status === "closed";
  const activeUnits = data.units.filter((u) => u.status === "active");
  const roomOptions = data.units.filter((u) => u.status === "active").flatMap((u) => u.rooms.filter((r) => r.status === "active").map((r) => ({ id: r.id, label: `${u.name} · ${r.name}`, establishmentId: data.establishment.id })));
  const people = [...data.units.flatMap((u) => u.rooms.flatMap((r) => r.occupants.map((p) => ({ person: p, roomId: r.id as string | null })))), ...data.residentsWithoutRoom.map((p) => ({ person: p, roomId: null as string | null }))];

  return (
    <div className="flex flex-col gap-6" data-testid="residential-establishment">
      <div>
        <Link to={RESIDENTIAL_ESTABLISHMENTS_PATH} className="text-[var(--text-small)] text-[var(--color-primary-700)]">← Establecimientos</Link>
        <PageHeader title={data.establishment.name} description={data.establishment.address ?? undefined} />
        {closed && <Badge tone="neutral">Cerrado</Badge>}
      </div>

      <Card><OccupancySummary occupancy={data.occupancy} /></Card>

      <section className="flex flex-col gap-3" aria-labelledby="units-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="units-title" className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Unidades y habitaciones</h2>
          {!closed && <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "unit" })}>Añadir unidad</Button>}
        </div>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Las habitaciones pueden ir directamente en «General». Las unidades adicionales (pisos, alas o sectores) son opcionales.</p>
        {data.units.map((u) => (
          <Card key={u.id} className="flex flex-col gap-3" data-testid="residential-unit">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-[var(--color-text-primary)]">{u.name}</h3>
                {u.isGeneral && <Badge tone="accent">General</Badge>}
                {u.status === "archived" && <Badge tone="neutral">Archivada</Badge>}
              </div>
              {!closed && u.status === "active" && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "room", unit: u })}>Añadir habitación</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "unit", unit: u })}>Editar unidad</Button>
                </div>
              )}
            </div>
            {u.rooms.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Sin habitaciones.</p> : (
              <ul className="flex flex-col divide-y divide-[var(--color-border)]">
                {u.rooms.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 py-2" data-testid="residential-room">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[var(--color-text-primary)]">Habitación {r.name}</span>
                      <span className="flex items-center gap-2 text-[var(--text-small)] text-[var(--color-text-secondary)]">
                        {r.bedCapacity === null ? "Camas: sin configurar" : `${r.occupants.length} de ${r.bedCapacity} camas`}
                        {r.overCapacity && <Badge tone="warning">Supera las camas</Badge>}
                        {r.status === "archived" && <Badge tone="neutral">Archivada</Badge>}
                        {!closed && <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "room", unit: u, room: r })}>Editar</Button>}
                      </span>
                    </div>
                    {r.occupants.length > 0 && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{r.occupants.map((p) => p.displayName).join(", ")}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="residents-title">
        <h2 id="residents-title" className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Ubicación de residentes</h2>
        {people.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">No hay residentes activos en este establecimiento.</p> : (
          <Card>
            <ul className="flex flex-col divide-y divide-[var(--color-border)]">
              {people.map(({ person, roomId }) => (
                <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-[var(--color-text-primary)]">{person.displayName}
                    <span className="ml-2 text-[var(--text-small)] text-[var(--color-text-secondary)]">{roomId ? roomOptions.find((o) => o.id === roomId)?.label ?? "" : "Sin habitación"}</span>
                  </span>
                  <span className="flex gap-2">
                    {!closed && <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "place", person, currentRoomId: roomId })}>Ubicar o trasladar</Button>}
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "history", person })}>Historial</Button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Card className="flex flex-col gap-2" data-testid="residential-geofence">
        <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Geocerca</h2>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
          Radio de {data.geofence?.radiusMeters ?? 100} m {data.geofence?.latitude === null || !data.geofence ? "· centro sin configurar" : "· centro configurado"}.
          Solo se usará al ponchar para marcar «dentro» o «fuera»: nunca impide un ponche, no rastrea y no guarda la ubicación de las personas.
        </p>
        {!closed && <div><Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "geofence" })}>Configurar geocerca</Button></div>}
      </Card>

      {!closed && (
        <Card className="flex flex-col gap-2" data-testid="residential-closure">
          <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Cerrar establecimiento</h2>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Archiva el establecimiento con sus unidades y habitaciones. No se borra nada. Requiere que no queden residentes activos, turnos vigentes o futuros ni asignaciones activas.</p>
          <div><Button variant="danger" size="sm" onClick={() => setDialog({ kind: "close" })}>Revisar y cerrar</Button></div>
        </Card>
      )}

      {dialog?.kind === "unit" && <UnitDialog unit={dialog.unit} activeRoomsCount={dialog.unit?.rooms.filter((r) => r.status === "active").length ?? 0} onClose={() => setDialog(null)}
        onSave={(body) => run((t) => dialog.unit ? residentialApi.updateUnit(organizationId, dialog.unit.id, body, t) : residentialApi.createUnit(organizationId, data.establishment.id, body.name ?? "", t), dialog.unit ? "Unidad actualizada." : "Unidad creada.")} />}
      {dialog?.kind === "room" && <RoomDialog unit={dialog.unit} room={dialog.room} units={activeUnits} onClose={() => setDialog(null)}
        onSave={(body) => run((t) => dialog.room ? residentialApi.updateRoom(organizationId, dialog.room.id, body, t) : residentialApi.createRoom(organizationId, data.establishment.id, { name: body.name ?? "", unitId: dialog.unit.id, bedCapacity: body.bedCapacity ?? null }, t), dialog.room ? "Habitación actualizada." : "Habitación creada.")} />}
      {dialog?.kind === "place" && <PlaceDialog person={dialog.person} currentRoomId={dialog.currentRoomId} establishmentId={data.establishment.id} organizationId={organizationId}
        establishments={all.filter((e) => e.status === "active")} onClose={() => setDialog(null)}
        onSave={async (body) => {
          const token = getToken(); if (!token) return;
          try {
            const r = await residentialApi.placeResident(organizationId, dialog.person.id, body, token);
            toast.show(r.placement.overCapacity ? "Ubicación guardada. Aviso: la habitación supera sus camas registradas." : "Ubicación guardada.", r.placement.overCapacity ? "warning" : "success");
            setDialog(null); await load();
          } catch (e) { toast.show(residentialErrorMessage(e), "danger"); }
        }} />}
      {dialog?.kind === "history" && <HistoryDialog organizationId={organizationId} person={dialog.person} onClose={() => setDialog(null)} />}
      {dialog?.kind === "geofence" && <GeofenceDialog organizationId={organizationId} establishmentId={data.establishment.id} current={data.geofence} onClose={() => setDialog(null)}
        onSave={(body) => run((t) => residentialApi.updateGeofence(organizationId, data.establishment.id, body, t), "Geocerca actualizada.")} />}
      {dialog?.kind === "close" && <CloseDialog organizationId={organizationId} establishmentId={data.establishment.id} name={data.establishment.name} onClose={() => setDialog(null)}
        onConfirm={(reason) => run((t) => residentialApi.close(organizationId, data.establishment.id, reason, t), "Establecimiento cerrado.")} />}
    </div>
  );
}

function Footer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button>{children}</div>;
}

function UnitDialog({ unit, activeRoomsCount, onClose, onSave }: { unit?: ResidentialUnit; activeRoomsCount: number; onClose: () => void; onSave: (b: { name?: string; archived?: boolean }) => Promise<boolean> }) {
  const [name, setName] = useState(unit?.name ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (body: { name?: string; archived?: boolean }) => { setBusy(true); await onSave(body); setBusy(false); };
  return (
    <Modal open onClose={onClose} title={unit ? "Editar unidad" : "Añadir unidad"} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy || name.trim().length === 0} onClick={() => void save({ name: name.trim() })}>Guardar</Button></Footer>}>
      <div className="flex flex-col gap-3">
        <Input label="Nombre" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} hint={unit?.isGeneral ? "«General» se puede renombrar, pero no archivar mientras tenga habitaciones activas." : "Por ejemplo: Planta alta, Ala norte."} />
        {unit && (
          <div className="flex flex-col gap-1">
            <Button variant="secondary" size="sm" disabled={busy || activeRoomsCount > 0} onClick={() => void save({ archived: true })}>Archivar unidad</Button>
            {activeRoomsCount > 0 && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Tiene {activeRoomsCount} habitación(es) activa(s): archívalas o muévelas primero.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RoomDialog({ unit, room, units, onClose, onSave }: { unit: ResidentialUnit; room?: ResidentialRoom; units: ResidentialUnit[]; onClose: () => void; onSave: (b: { name?: string; unitId?: string; archived?: boolean; bedCapacity?: number | null }) => Promise<boolean> }) {
  const [name, setName] = useState(room?.name ?? "");
  const [beds, setBeds] = useState(room?.bedCapacity ? String(room.bedCapacity) : "");
  const [unitId, setUnitId] = useState(unit.id);
  const [busy, setBusy] = useState(false);
  const bedValue = beds.trim() === "" ? null : Number(beds);
  const bedsValid = bedValue === null || (Number.isInteger(bedValue) && bedValue >= 1 && bedValue <= 20);
  const save = async (body: Parameters<typeof onSave>[0]) => { setBusy(true); await onSave(body); setBusy(false); };
  return (
    <Modal open onClose={onClose} title={room ? `Editar habitación ${room.name}` : `Añadir habitación en ${unit.name}`} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy || name.trim().length === 0 || !bedsValid} onClick={() => void save({ name: name.trim(), bedCapacity: bedValue, ...(room && unitId !== unit.id ? { unitId } : {}) })}>Guardar</Button></Footer>}>
      <div className="flex flex-col gap-3">
        <Input label="Nombre o número" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <Input label="Camas registradas (opcional)" inputMode="numeric" value={beds} onChange={(e) => setBeds(e.target.value)} error={bedsValid ? undefined : "Entre 1 y 20, o vacío."} hint={BEDS_DISCLAIMER} />
        {room && units.length > 1 && (
          <Select label="Unidad" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        )}
        {room && (
          <div className="flex flex-col gap-1">
            <Button variant="secondary" size="sm" disabled={busy || room.occupants.length > 0} onClick={() => void save({ archived: true })}>Archivar habitación</Button>
            {room.occupants.length > 0 && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Tiene residentes: muévelos antes de archivarla.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function PlaceDialog({ person, currentRoomId, establishmentId, organizationId, establishments, onClose, onSave }: {
  person: ResidentialPerson; currentRoomId: string | null; establishmentId: string; organizationId: string;
  establishments: ResidentialEstablishmentSummary[]; onClose: () => void;
  onSave: (b: { roomId: string | null; establishmentId?: string; reason?: string }) => Promise<void>;
}) {
  const [target, setTarget] = useState(establishmentId);
  const [rooms, setRooms] = useState<Array<{ id: string; label: string; full: boolean }>>([]);
  const [roomId, setRoomId] = useState<string>(currentRoomId ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const token = getToken(); if (!token) return;
    void residentialApi.getEstablishment(organizationId, target, token).then((r) => {
      setRooms(r.establishment.units.filter((u) => u.status === "active").flatMap((u) => u.rooms.filter((x) => x.status === "active")
        .map((x) => ({ id: x.id, label: `${u.name} · ${x.name}${x.bedCapacity === null ? "" : ` (${x.occupants.length}/${x.bedCapacity} camas)`}`, full: x.bedCapacity !== null && x.occupants.length >= x.bedCapacity }))));
    }).catch(() => setRooms([]));
  }, [organizationId, target]);
  const transfer = target !== establishmentId;
  return (
    <Modal open onClose={onClose} title={`Ubicar a ${person.displayName}`} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy} onClick={async () => { setBusy(true); await onSave({ roomId: roomId || null, establishmentId: target, ...(reason.trim().length >= 3 ? { reason: reason.trim() } : {}) }); setBusy(false); }}>Guardar</Button></Footer>}>
      <div className="flex flex-col gap-3">
        {establishments.length > 1 && (
          <Select label="Establecimiento" value={target} onChange={(e) => { setTarget(e.target.value); setRoomId(""); }}>
            {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        )}
        <Select label="Habitación" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">Sin habitación</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}{r.full ? " · llena" : ""}</option>)}
        </Select>
        {rooms.find((r) => r.id === roomId)?.full && <p role="status" className="text-[var(--text-small)] text-[var(--color-warning-700)]">La habitación ya tiene todas sus camas registradas ocupadas. Puedes guardar igualmente: es solo un aviso.</p>}
        <Textarea label={transfer ? "Motivo del traslado" : "Motivo (opcional)"} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}

function HistoryDialog({ organizationId, person, onClose }: { organizationId: string; person: ResidentialPerson; onClose: () => void }) {
  const [items, setItems] = useState<ResidentialPlacementEvent[] | null>(null);
  useEffect(() => { const t = getToken(); if (t) void residentialApi.residentHistory(organizationId, person.id, t).then((r) => setItems(r.history)).catch(() => setItems([])); }, [organizationId, person.id]);
  return (
    <Modal open onClose={onClose} title={`Historial de ubicación · ${person.displayName}`} sheetOnMobile>
      {items === null ? <Skeleton className="h-24" /> : items.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Sin movimientos registrados.</p> : (
        <ul className="flex flex-col gap-2">
          {items.map((h, i) => (
            <li key={`${h.occurredAt}-${i}`} className="text-[var(--text-small)]">
              <span className="font-medium text-[var(--color-text-primary)]">{new Date(h.occurredAt).toLocaleString("es-PR")}</span>
              <span className="block text-[var(--color-text-secondary)]">
                {(h.fromRoom ?? "Sin habitación")}{h.fromEstablishment && h.fromEstablishment !== h.toEstablishment ? ` (${h.fromEstablishment})` : ""} → {(h.toRoom ?? "Sin habitación")}{h.toEstablishment && h.fromEstablishment !== h.toEstablishment ? ` (${h.toEstablishment})` : ""}
                {h.reason ? ` · ${h.reason}` : ""}{h.actorEmail ? ` · ${h.actorEmail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function GeofenceDialog({ organizationId, establishmentId, current, onClose, onSave }: {
  organizationId: string; establishmentId: string; current: ResidentialEstablishmentDetail["geofence"]; onClose: () => void;
  onSave: (b: { radiusMeters: number; latitude?: number | null; longitude?: number | null; reason: string }) => Promise<boolean>;
}) {
  const [radius, setRadius] = useState(String(current?.radiusMeters ?? 100));
  const [lat, setLat] = useState(current?.latitude === null || current?.latitude === undefined ? "" : String(current.latitude));
  const [lng, setLng] = useState(current?.longitude === null || current?.longitude === undefined ? "" : String(current.longitude));
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<ResidentialGeofenceEvent[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = getToken(); if (t) void residentialApi.geofenceHistory(organizationId, establishmentId, t).then((r) => setHistory(r.history)).catch(() => setHistory([])); }, [organizationId, establishmentId]);
  const r = Number(radius), la = lat.trim() === "" ? null : Number(lat), lo = lng.trim() === "" ? null : Number(lng);
  const radiusOk = Number.isInteger(r) && r >= 50 && r <= 300;
  const centerOk = (la === null) === (lo === null) && (la === null || (la >= -90 && la <= 90 && lo !== null && lo >= -180 && lo <= 180));
  const ok = radiusOk && centerOk && reason.trim().length >= 3;
  return (
    <Modal open onClose={onClose} title="Geocerca del establecimiento" sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy || !ok} onClick={async () => { setBusy(true); await onSave({ radiusMeters: r, latitude: la, longitude: lo, reason: reason.trim() }); setBusy(false); }}>Guardar</Button></Footer>}>
      <div className="flex flex-col gap-3">
        <Input label="Radio en metros (50 a 300)" inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} error={radiusOk ? undefined : "Entre 50 y 300 m."} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Latitud del edificio" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          <Input label="Longitud del edificio" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} error={centerOk ? undefined : "Indica latitud y longitud válidas, o deja ambas vacías."} />
        </div>
        <Textarea label="Motivo del cambio" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} hint="Cada cambio queda registrado con su autor y su motivo." />
        {history.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[var(--text-small)] font-medium text-[var(--color-text-primary)]">Cambios anteriores</p>
            {history.slice(0, 5).map((h, i) => (
              <p key={`${h.occurredAt}-${i}`} className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                {new Date(h.occurredAt).toLocaleString("es-PR")}: {h.oldRadiusMeters ?? "—"} → {h.newRadiusMeters} m{h.centerChanged ? " · centro cambiado" : ""} · {h.reason}{h.actorEmail ? ` · ${h.actorEmail}` : ""}
              </p>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function CloseDialog({ organizationId, establishmentId, name, onClose, onConfirm }: { organizationId: string; establishmentId: string; name: string; onClose: () => void; onConfirm: (reason: string) => Promise<boolean> }) {
  const [check, setCheck] = useState<{ futureShifts: number; activeAssignments: number; activeResidents: number; canClose: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = getToken(); if (t) void residentialApi.closureCheck(organizationId, establishmentId, t).then((r) => setCheck(r.closure)).catch(() => setCheck(null)); }, [organizationId, establishmentId]);
  const ready = check?.canClose === true && reason.trim().length >= 3 && typed.trim() === name.trim();
  return (
    <Modal open onClose={onClose} title={`Cerrar ${name}`} sheetOnMobile
      footer={<Footer onClose={onClose}><Button variant="danger" disabled={busy || !ready} onClick={async () => { setBusy(true); await onConfirm(reason.trim()); setBusy(false); }}>Cerrar establecimiento</Button></Footer>}>
      {check === null ? <Skeleton className="h-24" /> : (
        <div className="flex flex-col gap-3">
          <ul className="text-[var(--text-small)] text-[var(--color-text-primary)]">
            <li>Residentes activos: {check.activeResidents}</li>
            <li>Turnos vigentes o futuros: {check.futureShifts}</li>
            <li>Asignaciones activas: {check.activeAssignments}</li>
          </ul>
          {!check.canClose ? <p role="status" className="text-[var(--text-small)] text-[var(--color-warning-700)]">No se puede cerrar todavía: resuelve primero lo anterior.</p> : (
            <>
              <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Se archivarán el establecimiento, sus unidades y habitaciones y los vínculos del personal con él. No se borra nada y no se puede deshacer desde el portal.</p>
              <Textarea label="Motivo del cierre" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
              <Input label={`Escribe «${name}» para confirmar`} value={typed} onChange={(e) => setTyped(e.target.value)} />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
