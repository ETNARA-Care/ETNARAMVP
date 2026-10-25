import { useState } from "react";
import { Check, ExternalLink, Move } from "lucide-react";
import { Button } from "@/components/ui";
import { LocationMapPicker } from "./LocationMapPicker";
import { MUNICIPALITY_CENTERS } from "./municipalityCenters";
import type { MapPoint } from "./mapLinks";

const fmt = (p: MapPoint) => `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;

/**
 * Preview of the place with its PIN. The map is read-only until «Ajustar PIN»: then a
 * tap places the PIN and a drag moves it. Without a PIN the map is centred on the
 * municipality (never a made-up point).
 */
export function PinPreview({ point, onChange, municipality, adjustable = true, className = "h-52" }: {
  point: MapPoint | null;
  onChange?: (p: MapPoint) => void;
  municipality?: string;
  adjustable?: boolean;
  className?: string;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const c = municipality ? MUNICIPALITY_CENTERS[municipality] : undefined;
  const center = !point && c ? { ...c, zoom: 14, key: `m:${municipality}` } : null;
  return (
    <div className="flex flex-col gap-2" data-ui="pin-preview">
      <LocationMapPicker value={point} onChange={(p) => onChange?.(p)} center={center} readOnly={!adjustable || !adjusting} className={className} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--text-small)]">
        <span className="text-[var(--color-text-secondary)]" aria-live="polite">
          {point ? <>PIN: <span className="font-mono text-[var(--color-text-primary)]">{fmt(point)}</span></> : adjusting ? "Toca el mapa en la entrada del domicilio." : "Aún no hay PIN."}
        </span>
        {adjustable && (
          <Button type="button" size="sm" variant={adjusting ? "primary" : "secondary"} icon={adjusting ? <Check size={16} /> : <Move size={16} />}
            onClick={() => setAdjusting((a) => !a)}>{adjusting ? "Listo" : point ? "Ajustar PIN" : "Colocar PIN"}</Button>
        )}
      </div>
      {adjusting && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Toca para colocar el PIN y arrástralo hasta la entrada. Acerca con dos dedos.</p>}
      {point && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--text-small)]">
          <a className="inline-flex items-center gap-1 font-medium text-[var(--color-navy-900)] underline" target="_blank" rel="noopener noreferrer"
            href={`https://maps.apple.com/?ll=${point.latitude},${point.longitude}&q=PIN&t=k`}>Ver en Apple Maps <ExternalLink size={14} aria-hidden /></a>
          <a className="inline-flex items-center gap-1 font-medium text-[var(--color-navy-900)] underline" target="_blank" rel="noopener noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`}>Ver en Google Maps <ExternalLink size={14} aria-hidden /></a>
        </div>
      )}
    </div>
  );
}
