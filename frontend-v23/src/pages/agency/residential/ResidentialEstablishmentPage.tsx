import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Badge, Button, Card, ErrorState, Input, Modal, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import {
  residentialApi, residentialErrorMessage, type ResidentialEstablishmentDetail, type ResidentialEstablishmentSummary,
  type ResidentialGeofenceEvent, type ResidentialPerson, type ResidentialPlacementEvent, type ResidentialRoom, type ResidentialUnit,
} from "@/api/residential";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";
import { isResidentialOrganization, RESIDENTIAL_ESTABLISHMENTS_PATH } from "@/features/residential/modality";
import { bedsDisclaimer, OccupancySummary } from "./OccupancySummary";

/** Fecha y hora en el idioma activo. */
const formatDateTime = (iso: string, language: string | undefined) => new Date(iso).toLocaleString(language === "en" ? "en-US" : "es-PR");

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
  const { t } = useTranslation("residential");
  // Protección de cambio de organización (como el panel, A4): el detalle va ligado a la organización y al
  // establecimiento que lo pidieron; una respuesta atrasada se descarta y nunca se muestran datos de otra organización.
  const [state, setState] = useState<OrganizationScoped<{ detail: ResidentialEstablishmentDetail; all: ResidentialEstablishmentSummary[] }> | null>(null);
  const [dialogState, setDialogState] = useState<{ organizationId: string; dialog: Dialog } | null>(null);
  const latest = useRef(createLatestRequest());

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential) return;
    const request = latest.current.begin();
    try {
      const [detail, list] = await Promise.all([
        residentialApi.getEstablishment(organizationId, establishmentId, token),
        residentialApi.listEstablishments(organizationId, token),
      ]);
      if (request.isCurrent()) setState({ organizationId, key: establishmentId, data: { detail: detail.establishment, all: list.establishments }, error: false });
    } catch {
      if (request.isCurrent()) setState({ organizationId, key: establishmentId, data: null, error: true });
    }
  }, [organizationId, establishmentId, residential]);
  useEffect(() => {
    const tracker = latest.current;
    void load();
    return () => tracker.invalidate();
  }, [load]);
  const current = scopedTo(state, organizationId, establishmentId);
  const data = current?.data?.detail ?? null;
  const all = current?.data?.all ?? [];
  const error = current?.error === true;
  // Un diálogo abierto pertenece a la organización en la que se abrió: al cambiar de organización desaparece.
  const dialog = dialogState && dialogState.organizationId === organizationId ? dialogState.dialog : null;
  const setDialog = (d: Dialog | null) => setDialogState(d ? { organizationId, dialog: d } : null);

  /** Ejecuta un cambio, avisa y vuelve a leer del servidor (fuente de verdad). */
  const run = async (fn: (token: string) => Promise<unknown>, ok: string): Promise<boolean> => {
    const token = getToken(); if (!token) return false;
    try { await fn(token); toast.show(ok, "success"); setDialog(null); await load(); return true; }
    catch (e) { toast.show(residentialErrorMessage(e), "danger"); return false; }
  };

  if (!residential) return <Navigate to="/agency" replace />;
  if (error) return <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} />;
  if (!data) return <Skeleton className="h-64" />;
  const closed = data.establishment.status === "closed";
  const activeUnits = data.units.filter((u) => u.status === "active");
  const roomOptions = data.units.filter((u) => u.status === "active").flatMap((u) => u.rooms.filter((r) => r.status === "active").map((r) => ({ id: r.id, label: `${u.name} · ${r.name}`, establishmentId: data.establishment.id })));
  const people = [...data.units.flatMap((u) => u.rooms.flatMap((r) => r.occupants.map((p) => ({ person: p, roomId: r.id as string | null })))), ...data.residentsWithoutRoom.map((p) => ({ person: p, roomId: null as string | null }))];

  return (
    <div className="flex flex-col gap-6" data-testid="residential-establishment">
      <div>
        <Link to={RESIDENTIAL_ESTABLISHMENTS_PATH} className="text-[var(--text-small)] text-[var(--color-primary-700)]">{t("establishments.back")}</Link>
        <PageHeader title={data.establishment.name} description={data.establishment.address ?? undefined} />
        {closed && <Badge tone="neutral">{t("establishments.closed")}</Badge>}
      </div>

      <Card><OccupancySummary occupancy={data.occupancy} /></Card>

      <section className="flex flex-col gap-3" aria-labelledby="units-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="units-title" className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{t("establishments.units.title")}</h2>
          {!closed && <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "unit" })}>{t("establishments.units.add")}</Button>}
        </div>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("establishments.units.hint")}</p>
        {data.units.map((u) => (
          <Card key={u.id} className="flex flex-col gap-3" data-testid="residential-unit">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-[var(--color-text-primary)]">{u.name}</h3>
                {u.isGeneral && <Badge tone="accent">{t("establishments.units.general")}</Badge>}
                {u.status === "archived" && <Badge tone="neutral">{t("establishments.units.archived")}</Badge>}
              </div>
              {!closed && u.status === "active" && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "room", unit: u })}>{t("establishments.units.addRoom")}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "unit", unit: u })}>{t("establishments.units.edit")}</Button>
                </div>
              )}
            </div>
            {u.rooms.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("establishments.units.noRooms")}</p> : (
              <ul className="flex flex-col divide-y divide-[var(--color-border)]">
                {u.rooms.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 py-2" data-testid="residential-room">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[var(--color-text-primary)]">{t("establishments.units.room", { name: r.name })}</span>
                      <span className="flex items-center gap-2 text-[var(--text-small)] text-[var(--color-text-secondary)]">
                        {r.bedCapacity === null ? t("establishments.units.bedsNotConfigured") : t("establishments.units.bedsOf", { occupied: r.occupants.length, capacity: r.bedCapacity })}
                        {r.overCapacity && <Badge tone="warning">{t("establishments.overCapacityBadge")}</Badge>}
                        {r.status === "archived" && <Badge tone="neutral">{t("establishments.units.archived")}</Badge>}
                        {!closed && <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "room", unit: u, room: r })}>{t("establishments.units.editRoom")}</Button>}
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
        <h2 id="residents-title" className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{t("establishments.residents.title")}</h2>
        {people.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("establishments.residents.empty")}</p> : (
          <Card>
            <ul className="flex flex-col divide-y divide-[var(--color-border)]">
              {people.map(({ person, roomId }) => (
                <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-[var(--color-text-primary)]">{person.displayName}
                    <span className="ml-2 text-[var(--text-small)] text-[var(--color-text-secondary)]">{roomId ? roomOptions.find((o) => o.id === roomId)?.label ?? "" : t("establishments.residents.withoutRoom")}</span>
                  </span>
                  <span className="flex gap-2">
                    {!closed && <Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "place", person, currentRoomId: roomId })}>{t("establishments.residents.place")}</Button>}
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "history", person })}>{t("establishments.residents.history")}</Button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <Card className="flex flex-col gap-2" data-testid="residential-geofence">
        <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{t("establishments.geofence.title")}</h2>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
          {t("establishments.geofence.radius", { radius: data.geofence?.radiusMeters ?? 100 })} {data.geofence?.latitude === null || !data.geofence ? t("establishments.geofence.centerMissing") : t("establishments.geofence.centerSet")}.{" "}
          {t("establishments.geofence.explain")}
        </p>
        {!closed && <div><Button variant="secondary" size="sm" onClick={() => setDialog({ kind: "geofence" })}>{t("establishments.geofence.configure")}</Button></div>}
      </Card>

      {!closed && (
        <Card className="flex flex-col gap-2" data-testid="residential-closure">
          <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{t("establishments.closure.title")}</h2>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("establishments.closure.explain")}</p>
          <div><Button variant="danger" size="sm" onClick={() => setDialog({ kind: "close" })}>{t("establishments.closure.review")}</Button></div>
        </Card>
      )}

      {dialog?.kind === "unit" && <UnitDialog unit={dialog.unit} activeRoomsCount={dialog.unit?.rooms.filter((r) => r.status === "active").length ?? 0} onClose={() => setDialog(null)}
        onSave={(body) => run((t) => dialog.unit ? residentialApi.updateUnit(organizationId, dialog.unit.id, body, t) : residentialApi.createUnit(organizationId, data.establishment.id, body.name ?? "", t), dialog.unit ? t("establishments.toasts.unitUpdated") : t("establishments.toasts.unitCreated"))} />}
      {dialog?.kind === "room" && <RoomDialog unit={dialog.unit} room={dialog.room} units={activeUnits} onClose={() => setDialog(null)}
        onSave={(body) => run((t) => dialog.room ? residentialApi.updateRoom(organizationId, dialog.room.id, body, t) : residentialApi.createRoom(organizationId, data.establishment.id, { name: body.name ?? "", unitId: dialog.unit.id, bedCapacity: body.bedCapacity ?? null }, t), dialog.room ? t("establishments.toasts.roomUpdated") : t("establishments.toasts.roomCreated"))} />}
      {dialog?.kind === "place" && <PlaceDialog person={dialog.person} currentRoomId={dialog.currentRoomId} establishmentId={data.establishment.id} organizationId={organizationId}
        establishments={all.filter((e) => e.status === "active")} onClose={() => setDialog(null)}
        onSave={async (body) => {
          const token = getToken(); if (!token) return;
          try {
            const r = await residentialApi.placeResident(organizationId, dialog.person.id, body, token);
            toast.show(r.placement.overCapacity ? t("establishments.toasts.placedOver") : t("establishments.toasts.placed"), r.placement.overCapacity ? "warning" : "success");
            setDialog(null); await load();
          } catch (e) { toast.show(residentialErrorMessage(e), "danger"); }
        }} />}
      {dialog?.kind === "history" && <HistoryDialog organizationId={organizationId} person={dialog.person} onClose={() => setDialog(null)} />}
      {dialog?.kind === "geofence" && <GeofenceDialog organizationId={organizationId} establishmentId={data.establishment.id} current={data.geofence} onClose={() => setDialog(null)}
        onSave={(body) => run((t) => residentialApi.updateGeofence(organizationId, data.establishment.id, body, t), t("establishments.toasts.geofence"))} />}
      {dialog?.kind === "close" && <CloseDialog organizationId={organizationId} establishmentId={data.establishment.id} name={data.establishment.name} onClose={() => setDialog(null)}
        onConfirm={(reason) => run((t) => residentialApi.close(organizationId, data.establishment.id, reason, t), t("establishments.toasts.closed"))} />}
    </div>
  );
}

function Footer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation("residential");
  return <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("establishments.dialogs.cancel")}</Button>{children}</div>;
}

function UnitDialog({ unit, activeRoomsCount, onClose, onSave }: { unit?: ResidentialUnit; activeRoomsCount: number; onClose: () => void; onSave: (b: { name?: string; archived?: boolean }) => Promise<boolean> }) {
  const { t } = useTranslation("residential");
  const [name, setName] = useState(unit?.name ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (body: { name?: string; archived?: boolean }) => { setBusy(true); await onSave(body); setBusy(false); };
  return (
    <Modal open onClose={onClose} title={unit ? t("establishments.dialogs.unitEdit") : t("establishments.dialogs.unitAdd")} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy || name.trim().length === 0} onClick={() => void save({ name: name.trim() })}>{t("establishments.dialogs.save")}</Button></Footer>}>
      <div className="flex flex-col gap-3">
        <Input label={t("establishments.dialogs.name")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} hint={unit?.isGeneral ? t("establishments.dialogs.generalHint") : t("establishments.dialogs.unitHint")} />
        {unit && (
          <div className="flex flex-col gap-1">
            <Button variant="secondary" size="sm" disabled={busy || activeRoomsCount > 0} onClick={() => void save({ archived: true })}>{t("establishments.dialogs.archiveUnit")}</Button>
            {activeRoomsCount > 0 && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("establishments.dialogs.unitActiveRooms", { count: activeRoomsCount })}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RoomDialog({ unit, room, units, onClose, onSave }: { unit: ResidentialUnit; room?: ResidentialRoom; units: ResidentialUnit[]; onClose: () => void; onSave: (b: { name?: string; unitId?: string; archived?: boolean; bedCapacity?: number | null }) => Promise<boolean> }) {
  const { t } = useTranslation("residential");
  const [name, setName] = useState(room?.name ?? "");
  const [beds, setBeds] = useState(room?.bedCapacity ? String(room.bedCapacity) : "");
  const [unitId, setUnitId] = useState(unit.id);
  const [busy, setBusy] = useState(false);
  const bedValue = beds.trim() === "" ? null : Number(beds);
  // Sin tope de negocio: solo un número entero positivo (el máximo es el de un entero de la base de datos).
  const bedsValid = bedValue === null || (Number.isInteger(bedValue) && bedValue >= 1 && bedValue <= 2147483647);
  const save = async (body: Parameters<typeof onSave>[0]) => { setBusy(true); await onSave(body); setBusy(false); };
  return (
    <Modal open onClose={onClose} title={room ? t("establishments.dialogs.roomEdit", { name: room.name }) : t("establishments.dialogs.roomAdd", { unit: unit.name })} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy || name.trim().length === 0 || !bedsValid} onClick={() => void save({ name: name.trim(), bedCapacity: bedValue, ...(room && unitId !== unit.id ? { unitId } : {}) })}>{t("establishments.dialogs.save")}</Button></Footer>}>
      <div className="flex flex-col gap-3">
        <Input label={t("establishments.dialogs.roomName")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <Input label={t("establishments.dialogs.beds")} inputMode="numeric" value={beds} onChange={(e) => setBeds(e.target.value)} error={bedsValid ? undefined : t("establishments.dialogs.bedsError")} hint={bedsDisclaimer()} />
        {room && units.length > 1 && (
          <Select label={t("establishments.dialogs.unit")} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        )}
        {room && (
          <div className="flex flex-col gap-1">
            <Button variant="secondary" size="sm" disabled={busy || room.occupants.length > 0} onClick={() => void save({ archived: true })}>{t("establishments.dialogs.archiveRoom")}</Button>
            {room.occupants.length > 0 && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("establishments.dialogs.roomHasResidents")}</p>}
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
  const { t } = useTranslation("residential");
  const [target, setTarget] = useState(establishmentId);
  const [rooms, setRooms] = useState<Array<{ id: string; label: string; full: boolean }>>([]);
  const [roomId, setRoomId] = useState<string>(currentRoomId ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const token = getToken(); if (!token) return;
    let active = true; // una respuesta de otro establecimiento u organización ya no se aplica
    void residentialApi.getEstablishment(organizationId, target, token).then((r) => {
      if (!active) return;
      setRooms(r.establishment.units.filter((u) => u.status === "active").flatMap((u) => u.rooms.filter((x) => x.status === "active")
        .map((x) => ({ id: x.id, label: `${u.name} · ${x.name}${x.bedCapacity === null ? "" : t("establishments.dialogs.roomBeds", { occupied: x.occupants.length, capacity: x.bedCapacity })}`, full: x.bedCapacity !== null && x.occupants.length >= x.bedCapacity }))));
    }).catch(() => { if (active) setRooms([]); });
    return () => { active = false; };
  }, [organizationId, target, t]);
  const transfer = target !== establishmentId;
  return (
    <Modal open onClose={onClose} title={t("establishments.dialogs.placeTitle", { name: person.displayName })} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy} onClick={async () => { setBusy(true); await onSave({ roomId: roomId || null, establishmentId: target, ...(reason.trim().length >= 3 ? { reason: reason.trim() } : {}) }); setBusy(false); }}>{t("establishments.dialogs.save")}</Button></Footer>}>
      <div className="flex flex-col gap-3">
        {establishments.length > 1 && (
          <Select label={t("establishments.dialogs.establishment")} value={target} onChange={(e) => { setTarget(e.target.value); setRoomId(""); }}>
            {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        )}
        <Select label={t("establishments.dialogs.room")} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">{t("establishments.dialogs.noRoom")}</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}{r.full ? t("establishments.dialogs.full") : ""}</option>)}
        </Select>
        {rooms.find((r) => r.id === roomId)?.full && <p role="status" className="text-[var(--text-small)] text-[var(--color-warning-700)]">{t("establishments.dialogs.fullWarning")}</p>}
        <Textarea label={transfer ? t("establishments.dialogs.transferReason") : t("establishments.dialogs.optionalReason")} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}

function HistoryDialog({ organizationId, person, onClose }: { organizationId: string; person: ResidentialPerson; onClose: () => void }) {
  const { t, i18n } = useTranslation("residential");
  const [items, setItems] = useState<ResidentialPlacementEvent[] | null>(null);
  useEffect(() => { const t = getToken(); if (!t) return; let active = true;
    void residentialApi.residentHistory(organizationId, person.id, t).then((r) => { if (active) setItems(r.history); }).catch(() => { if (active) setItems([]); });
    return () => { active = false; }; }, [organizationId, person.id]);
  return (
    <Modal open onClose={onClose} title={t("establishments.dialogs.historyTitle", { name: person.displayName })} sheetOnMobile>
      {items === null ? <Skeleton className="h-24" /> : items.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("establishments.dialogs.historyEmpty")}</p> : (
        <ul className="flex flex-col gap-2">
          {items.map((h, i) => (
            <li key={`${h.occurredAt}-${i}`} className="text-[var(--text-small)]">
              <span className="font-medium text-[var(--color-text-primary)]">{formatDateTime(h.occurredAt, i18n.resolvedLanguage)}</span>
              <span className="block text-[var(--color-text-secondary)]">
                {(h.fromRoom ?? t("establishments.dialogs.noRoom"))}{h.fromEstablishment && h.fromEstablishment !== h.toEstablishment ? ` (${h.fromEstablishment})` : ""} → {(h.toRoom ?? t("establishments.dialogs.noRoom"))}{h.toEstablishment && h.fromEstablishment !== h.toEstablishment ? ` (${h.toEstablishment})` : ""}
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
  const { t, i18n } = useTranslation("residential");
  const [radius, setRadius] = useState(String(current?.radiusMeters ?? 100));
  const [lat, setLat] = useState(current?.latitude === null || current?.latitude === undefined ? "" : String(current.latitude));
  const [lng, setLng] = useState(current?.longitude === null || current?.longitude === undefined ? "" : String(current.longitude));
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<ResidentialGeofenceEvent[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = getToken(); if (!t) return; let active = true;
    void residentialApi.geofenceHistory(organizationId, establishmentId, t).then((r) => { if (active) setHistory(r.history); }).catch(() => { if (active) setHistory([]); });
    return () => { active = false; }; }, [organizationId, establishmentId]);
  const r = Number(radius), la = lat.trim() === "" ? null : Number(lat), lo = lng.trim() === "" ? null : Number(lng);
  const radiusOk = Number.isInteger(r) && r >= 50 && r <= 300;
  const centerOk = (la === null) === (lo === null) && (la === null || (la >= -90 && la <= 90 && lo !== null && lo >= -180 && lo <= 180));
  const ok = radiusOk && centerOk && reason.trim().length >= 3;
  return (
    <Modal open onClose={onClose} title={t("establishments.geofence.dialogTitle")} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy || !ok} onClick={async () => { setBusy(true); await onSave({ radiusMeters: r, latitude: la, longitude: lo, reason: reason.trim() }); setBusy(false); }}>{t("establishments.dialogs.save")}</Button></Footer>}>
      <div className="flex flex-col gap-3">
        <Input label={t("establishments.geofence.radiusLabel")} inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} error={radiusOk ? undefined : t("establishments.geofence.radiusError")} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("establishments.geofence.lat")} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          <Input label={t("establishments.geofence.lng")} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} error={centerOk ? undefined : t("establishments.geofence.centerError")} />
        </div>
        <Textarea label={t("establishments.geofence.reason")} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} hint={t("establishments.geofence.reasonHint")} />
        {history.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[var(--text-small)] font-medium text-[var(--color-text-primary)]">{t("establishments.geofence.previous")}</p>
            {history.slice(0, 5).map((h, i) => (
              <p key={`${h.occurredAt}-${i}`} className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                {t("establishments.geofence.historyLine", { date: formatDateTime(h.occurredAt, i18n.resolvedLanguage), from: h.oldRadiusMeters ?? "—", to: h.newRadiusMeters, center: h.centerChanged ? t("establishments.geofence.centerChanged") : "", reason: h.reason, actor: h.actorEmail ? ` · ${h.actorEmail}` : "" })}
              </p>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function CloseDialog({ organizationId, establishmentId, name, onClose, onConfirm }: { organizationId: string; establishmentId: string; name: string; onClose: () => void; onConfirm: (reason: string) => Promise<boolean> }) {
  const { t } = useTranslation("residential");
  const [check, setCheck] = useState<{ futureShifts: number; activeAssignments: number; activeResidents: number; canClose: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = getToken(); if (!t) return; let active = true;
    void residentialApi.closureCheck(organizationId, establishmentId, t).then((r) => { if (active) setCheck(r.closure); }).catch(() => { if (active) setCheck(null); });
    return () => { active = false; }; }, [organizationId, establishmentId]);
  const ready = check?.canClose === true && reason.trim().length >= 3 && typed.trim() === name.trim();
  return (
    <Modal open onClose={onClose} title={t("establishments.closure.dialogTitle", { name })} sheetOnMobile
      footer={<Footer onClose={onClose}><Button variant="danger" disabled={busy || !ready} onClick={async () => { setBusy(true); await onConfirm(reason.trim()); setBusy(false); }}>{t("establishments.closure.submit")}</Button></Footer>}>
      {check === null ? <Skeleton className="h-24" /> : (
        <div className="flex flex-col gap-3">
          <ul className="text-[var(--text-small)] text-[var(--color-text-primary)]">
            <li>{t("establishments.closure.activeResidents", { count: check.activeResidents })}</li>
            <li>{t("establishments.closure.futureShifts", { count: check.futureShifts })}</li>
            <li>{t("establishments.closure.activeAssignments", { count: check.activeAssignments })}</li>
          </ul>
          {!check.canClose ? <p role="status" className="text-[var(--text-small)] text-[var(--color-warning-700)]">{t("establishments.closure.cannot")}</p> : (
            <>
              <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("establishments.closure.willArchive")}</p>
              <Textarea label={t("establishments.closure.reason")} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
              <Input label={t("establishments.closure.confirm", { name })} value={typed} onChange={(e) => setTyped(e.target.value)} />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
