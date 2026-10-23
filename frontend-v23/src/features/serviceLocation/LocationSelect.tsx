import type { ShiftLocationOption } from "@/api/serviceLocations";
import { Select } from "@/components/ui";

/**
 * «Dirección del servicio» in the Turnos form (Gate 6). Shows whether the exact
 * point is GPS-confirmed; without it the shift can still be created and
 * navigation will use the written address (approximate). Never blocks.
 */
export function LocationSelect({ options, value, onChange, requireChoice }: {
  options: ShiftLocationOption[] | null; value: string; onChange: (id: string) => void; requireChoice?: boolean;
}) {
  if (options === null) return null;
  if (options.length === 0) {
    return <p className="text-[var(--text-small)] text-[var(--color-warning-700)]">Esta persona no tiene dirección registrada. Añádela en su expediente para que la cuidadora pueda llegar.</p>;
  }
  const selected = options.find((o) => o.id === value);
  return (
    <div className="flex flex-col gap-1.5">
      <Select label="Dirección del servicio" value={value} onChange={(e) => onChange(e.target.value)} required
        hint={requireChoice ? "Confirma dónde será el servicio. Solo la verá la cuidadora asignada." : "La cuidadora asignada la verá en «Cómo llegar»."}>
        {(requireChoice || !value) && <option value="">Selecciona la dirección</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}{o.isPrimary ? " (principal)" : ""} · {o.gpsConfirmed ? "GPS confirmado" : "sin GPS confirmado"} — {o.summary}</option>
        ))}
      </Select>
      {selected && (selected.gpsConfirmed
        ? <p className="text-[var(--text-caption)] text-[var(--color-success-700)]" data-testid="location-gps-state">Punto exacto confirmado: la navegación llegará al marcador.</p>
        : <p role="status" className="rounded-[var(--radius-sm)] bg-[var(--color-ivory-100)] p-2 text-[var(--text-caption)] text-[var(--color-warning-700)]" data-testid="location-gps-state">
            Sin GPS confirmado: puedes crear el turno, pero la navegación usará la dirección escrita y el destino podría ser aproximado. Confírmalo en el expediente con «Ubicar en el mapa».
          </p>)}
    </div>
  );
}
