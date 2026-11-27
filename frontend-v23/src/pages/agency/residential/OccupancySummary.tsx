import { useTranslation } from "react-i18next";
import type { ResidentialOccupancy } from "@/api/residential";
import i18n from "@/i18n";

/**
 * Aviso fijo (D8): las camas son las que registra el hogar; nunca se presentan como un permiso del Estado.
 * Texto en el catálogo «residential» (es/en); esta función devuelve el del idioma activo.
 */
export const bedsDisclaimer = () => i18n.t("residential:establishments.occupancy.disclaimer");

/** 171 · Ocupación del establecimiento. Sin camas registradas muestra «Sin configurar». */
export function OccupancySummary({ occupancy, compact = false }: { occupancy: ResidentialOccupancy; compact?: boolean }) {
  const { t } = useTranslation("residential");
  const o = occupancy;
  const notConfigured = t("establishments.occupancy.notConfigured");
  const cells: Array<[string, string]> = [
    [t("establishments.occupancy.activeResidents"), String(o.activeResidents)],
    [t("establishments.occupancy.rooms"), String(o.rooms)],
    [t("establishments.occupancy.bedsRegistered"), o.capacityConfigured ? String(o.bedsRegistered) : notConfigured],
    [t("establishments.occupancy.occupancy"), o.occupancyPercent === null ? notConfigured : t("establishments.occupancy.percent", { value: o.occupancyPercent })],
  ];
  if (!compact) cells.push(
    [t("establishments.occupancy.bedsOccupied"), o.capacityConfigured ? String(o.bedsOccupied) : "—"],
    [t("establishments.occupancy.bedsAvailable"), o.capacityConfigured ? String(o.bedsAvailable) : "—"],
    [t("establishments.occupancy.withoutRoom"), String(o.residentsWithoutRoom)],
  );
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
        <p role="status" className="text-[var(--text-small)] font-medium text-[var(--color-warning-700)]">{t("establishments.occupancy.overCapacity")}</p>
      )}
      {!compact && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("establishments.occupancy.disclaimer")}</p>}
    </div>
  );
}
