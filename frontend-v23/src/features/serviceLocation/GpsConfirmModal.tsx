import { useEffect, useState } from "react";
import { Crosshair, ExternalLink, Search } from "lucide-react";
import type { ApiError } from "@/api/client";
import { confirmLocationGps, type ServiceLocation } from "@/api/serviceLocations";
import { getToken } from "@/auth/token";
import { Button, Checkbox, Modal, Select, useToast } from "@/components/ui";
import { PUERTO_RICO_MUNICIPALITIES } from "@/features/smartmatch/municipalities";
import { LocationMapPicker } from "./LocationMapPicker";
import { MUNICIPALITY_CENTERS } from "./municipalityCenters";
import { serviceAddressText } from "./navigation";
import { PasteLocation } from "./PasteLocation";

type Point = { latitude: number; longitude: number };
const fmt = (p: Point) => `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;

/**
 * «Ubicar en el mapa» (Gate 6 fix): the administrator places the exact point of
 * the service and confirms it explicitly. The local search only moves the map
 * (municipality centre or a pasted Apple/Google Maps link); it never confirms.
 */
export function GpsConfirmModal({ open, organizationId, recipientId, location, onClose, onConfirmed }: {
  open: boolean; organizationId: string; recipientId: string; location: ServiceLocation | null;
  onClose: () => void; onConfirmed: () => void;
}) {
  const { show } = useToast();
  const initial = location?.latitude != null && location.longitude != null ? { latitude: location.latitude, longitude: location.longitude } : null;
  const [point, setPoint] = useState<Point | null>(initial);
  const [municipality, setMunicipality] = useState(location?.municipality ?? "");
  const [center, setCenter] = useState<{ lat: number; lng: number; zoom: number; key: string } | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset for each address opened; centre on its municipality when there is no marker yet.
  useEffect(() => {
    if (!open) return;
    setPoint(initial); setSure(false);
    const m = location?.municipality ?? "";
    setMunicipality(m);
    setCenter(!initial && MUNICIPALITY_CENTERS[m] ? { ...MUNICIPALITY_CENTERS[m], zoom: 14, key: `open:${location?.id}:${m}` } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, location?.id]);

  function goToMunicipality(m: string) {
    setMunicipality(m);
    const c = MUNICIPALITY_CENTERS[m];
    if (c) setCenter({ ...c, zoom: 14, key: `m:${m}:${Date.now()}` });
  }

  async function confirm() {
    const token = getToken();
    if (!token || !location || !point || !sure) return;
    setBusy(true);
    try {
      await confirmLocationGps(organizationId, recipientId, location.id, point, token);
      show("Punto exacto confirmado. La cuidadora navegará hasta aquí.", "success");
      onConfirmed();
    } catch (e) {
      show((e as ApiError)?.code === "INVALID_PAYLOAD" ? "El punto debe estar en Puerto Rico." : "No se pudo confirmar el punto.", "danger");
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Ubicar en el mapa" fullScreenOnMobile
      footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button loading={busy} disabled={!point || !sure} icon={<Crosshair size={18} />} onClick={() => void confirm()}>Confirmar GPS</Button>
      </div>}>
      {location && <div className="flex flex-col gap-3">
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">{location.label}:</strong> {serviceAddressText(location) || "sin dirección escrita"}
        </p>

        <fieldset className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3" aria-label="Buscar en el mapa">
          <legend className="flex items-center gap-1.5 px-1 text-[var(--text-small)] font-medium"><Search size={15} aria-hidden /> Buscar</legend>
          <Select label="Municipio" value={municipality} onChange={(e) => goToMunicipality(e.target.value)}>
            <option value="">Selecciona para centrar el mapa</option>
            {PUERTO_RICO_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <PasteLocation label="Enlace de mapas o coordenadas (opcional)"
            onPoint={(p) => { setPoint(p); setSure(false); setCenter({ lat: p.latitude, lng: p.longitude, zoom: 18, key: `p:${p.latitude},${p.longitude}` }); }}
            onAddress={(h) => { if (!point && h.municipality) goToMunicipality(h.municipality); }} />
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Nada se confirma solo: revisa el marcador y confírmalo tú.</p>
        </fieldset>

        <LocationMapPicker value={point} onChange={(p) => { setPoint(p); setSure(false); }} center={center} className="h-[45dvh] min-h-[240px]" />
        <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Toca el mapa para colocar el marcador y arrástralo hasta la entrada del domicilio. Acerca con dos dedos.</p>

        <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)]" aria-live="polite" data-testid="gps-preview">
          {point ? <>
            <p>Punto seleccionado: <strong className="font-mono">{fmt(point)}</strong></p>
            <div className="mt-2 flex flex-wrap gap-3">
              <a className="inline-flex items-center gap-1 font-medium text-[var(--color-navy-900)] underline" target="_blank" rel="noopener noreferrer"
                href={`https://maps.apple.com/?ll=${point.latitude},${point.longitude}&q=Punto&t=k`}>Vista previa en Apple Maps <ExternalLink size={14} aria-hidden /></a>
              <a className="inline-flex items-center gap-1 font-medium text-[var(--color-navy-900)] underline" target="_blank" rel="noopener noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`}>Vista previa en Google Maps <ExternalLink size={14} aria-hidden /></a>
            </div>
          </> : <p>Aún no hay marcador.</p>}
        </div>

        <Checkbox label="Confirmo que el marcador está en la entrada del domicilio donde se presta el servicio." checked={sure} disabled={!point}
          onChange={(e) => setSure(e.target.checked)} />
      </div>}
    </Modal>
  );
}
