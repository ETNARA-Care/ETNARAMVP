import { Copy, MapPin, Navigation } from "lucide-react";
import type { ShiftServiceLocation } from "@/api/serviceLocations";
import { Card, useToast } from "@/components/ui";
import { appleMapsUrl, canNavigateTo, googleMapsUrl, serviceAddressText, wazeUrl } from "./navigation";

/**
 * «Cómo llegar» for the caregiver's authorized shift (Gate 6). The address comes
 * from the shift's confirmed location; the buttons open the maps apps directly.
 * No in-app GPS navigation and no shareable ETNARA link to the address.
 */
export function ServiceDirectionsCard({ location }: { location: ShiftServiceLocation | null }) {
  const { show } = useToast();
  if (!location || (!canNavigateTo(location) && !location.accessNotes)) return null;
  const text = serviceAddressText(location);

  async function copy() {
    try { await navigator.clipboard.writeText(text); show("Dirección copiada.", "success"); }
    catch { show("No se pudo copiar. Mantén presionada la dirección para copiarla.", "danger"); }
  }
  const link = "flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-navy-900)] active:scale-95 transition-transform";

  return (
    <Card aria-label="Cómo llegar">
      <div className="mb-3 flex items-center gap-2"><MapPin size={20} aria-hidden /><p className="font-medium text-[var(--color-text-primary)]">Cómo llegar</p></div>
      {location.label && <p className="text-[var(--text-caption)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{location.label}</p>}
      {text && <p className="select-text text-[var(--text-body)] text-[var(--color-text-primary)]">{text}</p>}
      {location.accessNotes && (
        <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-ivory-100)] p-3">
          <p className="text-[var(--text-caption)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Para llegar</p>
          <p className="mt-1 whitespace-pre-line text-[var(--text-small)] text-[var(--color-text-primary)]">{location.accessNotes}</p>
        </div>
      )}
      {canNavigateTo(location) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a className={link} href={appleMapsUrl(location)} target="_blank" rel="noopener noreferrer"><Navigation size={18} aria-hidden />Apple Maps</a>
          <a className={link} href={googleMapsUrl(location)} target="_blank" rel="noopener noreferrer"><Navigation size={18} aria-hidden />Google Maps</a>
          <a className={link} href={wazeUrl(location)} target="_blank" rel="noopener noreferrer"><Navigation size={18} aria-hidden />Waze</a>
          {text && <button type="button" className={link} onClick={() => void copy()}><Copy size={18} aria-hidden />Copiar</button>}
        </div>
      )}
    </Card>
  );
}
