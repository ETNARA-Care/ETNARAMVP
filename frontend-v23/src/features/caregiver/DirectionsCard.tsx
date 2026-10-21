import { Copy, MapPin, Navigation } from "lucide-react";
import type { RecipientLocation } from "@/api/recipientLocation";
import { Card, useToast } from "@/components/ui";
import { addressText, canNavigate, googleMapsUrl, wazeUrl } from "./directions";

/** "Cómo llegar": dirección, notas de acceso y botones para abrir el mapa. */
export function DirectionsCard({ location }: { location: RecipientLocation | null }) {
  const { show } = useToast();
  if (!location || (!canNavigate(location) && !location.access_notes)) return null;
  const text = addressText(location);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      show("Dirección copiada.", "success");
    } catch {
      show("No se pudo copiar. Mantén presionada la dirección para copiarla.", "danger");
    }
  }

  const linkClass = "flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-navy-900)] active:scale-95 transition-transform";

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3"><MapPin size={20} aria-hidden /><p className="font-medium text-[var(--color-text-primary)]">Cómo llegar</p></div>
      {text && <p className="select-text text-[var(--text-body)] text-[var(--color-text-primary)]">{text}</p>}
      {location.access_notes && (
        <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-ivory-100)] p-3">
          <p className="text-[var(--text-caption)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Para llegar</p>
          <p className="mt-1 whitespace-pre-line text-[var(--text-small)] text-[var(--color-text-primary)]">{location.access_notes}</p>
        </div>
      )}
      {canNavigate(location) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a className={linkClass} href={googleMapsUrl(location)} target="_blank" rel="noopener noreferrer"><Navigation size={18} aria-hidden />Google Maps</a>
          <a className={linkClass} href={wazeUrl(location)} target="_blank" rel="noopener noreferrer"><Navigation size={18} aria-hidden />Waze</a>
          {text && <button type="button" className={`${linkClass} col-span-2`} onClick={() => void copy()}><Copy size={18} aria-hidden />Copiar dirección</button>}
        </div>
      )}
    </Card>
  );
}
