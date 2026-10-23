import type { ShiftLocationOption } from "@/api/serviceLocations";
import { Select } from "@/components/ui";

/** «Dirección del servicio» in the Turnos form (Gate 6). */
export function LocationSelect({ options, value, onChange, requireChoice }: {
  options: ShiftLocationOption[] | null; value: string; onChange: (id: string) => void; requireChoice?: boolean;
}) {
  if (options === null) return null;
  if (options.length === 0) {
    return <p className="text-[var(--text-small)] text-[var(--color-warning-700)]">Esta persona no tiene dirección registrada. Añádela en su expediente para que la cuidadora pueda llegar.</p>;
  }
  return (
    <Select label="Dirección del servicio" value={value} onChange={(e) => onChange(e.target.value)} required
      hint={requireChoice ? "Confirma dónde será el servicio. Solo la verá la cuidadora asignada." : "La cuidadora asignada la verá en «Cómo llegar»."}>
      {(requireChoice || !value) && <option value="">Selecciona la dirección</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}{o.isPrimary ? " (principal)" : ""}{o.verified ? "" : " · sin verificar"} — {o.summary}</option>
      ))}
    </Select>
  );
}
