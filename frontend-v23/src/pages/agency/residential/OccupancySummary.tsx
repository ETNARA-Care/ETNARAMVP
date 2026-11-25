import type { ResidentialOccupancy } from "@/api/residential";

/** Aviso fijo (D8): las camas son las que registra el hogar; nunca se presentan como un permiso del Estado. */
export const BEDS_DISCLAIMER = "Camas registradas por el hogar. No equivale a la capacidad autorizada por el Departamento de la Familia.";

/** 171 · Ocupación del establecimiento. Sin camas registradas muestra «Sin configurar». */
export function OccupancySummary({ occupancy, compact = false }: { occupancy: ResidentialOccupancy; compact?: boolean }) {
  const o = occupancy;
  const cells: Array<[string, string]> = [
    ["Residentes activos", String(o.activeResidents)],
    ["Habitaciones", String(o.rooms)],
    ["Camas registradas", o.capacityConfigured ? String(o.bedsRegistered) : "Sin configurar"],
    ["Ocupación", o.occupancyPercent === null ? "Sin configurar" : `${o.occupancyPercent} %`],
  ];
  if (!compact) cells.push(["Camas ocupadas", o.capacityConfigured ? String(o.bedsOccupied) : "—"], ["Camas disponibles", o.capacityConfigured ? String(o.bedsAvailable) : "—"], ["Sin habitación", String(o.residentsWithoutRoom)]);
  return (
    <div className="flex flex-col gap-2" data-testid="residential-occupancy">
      <dl className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{label}</dt>
            <dd className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{value}</dd>
          </div>
        ))}
      </dl>
      {o.overCapacity && (
        <p role="status" className="text-[var(--text-small)] font-medium text-[var(--color-warning-700)]">
          Hay más residentes que camas registradas en al menos una habitación. Es solo un aviso: no se bloquea nada.
        </p>
      )}
      {!compact && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{BEDS_DISCLAIMER}</p>}
    </div>
  );
}
