import { AlertTriangle } from "lucide-react";
import { formatCents } from "./money";

/**
 * F1.1 — shown when the agency bills a client less than it pays the caregiver
 * for the same service. It informs and never blocks: the agency may have a
 * reason (a promotion, a family discount, a specialised caregiver).
 * Never presented as "profit": it is the estimated gross margin only.
 */
export function NegativeMarginNotice({ billCents, payCents, per, tone = "light", className = "" }: {
  billCents: number; payCents: number; per?: string; tone?: "light" | "dark"; className?: string;
}) {
  const diff = billCents - payCents;
  const colors = tone === "dark"
    ? "border-amber-300/60 bg-amber-300/15 text-amber-50"
    : "border-[var(--color-warning-700)] bg-[var(--color-warning-100)] text-[var(--color-warning-700)]";
  return (
    <div role="status" data-negative-margin className={`flex items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm ${colors} ${className}`}>
      <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
      <p className="min-w-0">
        <strong>Margen negativo:</strong> cobras {formatCents(billCents)} y pagas {formatCents(payCents)} ({formatCents(diff)}{per ? ` ${per}` : ""}).
        {" "}Revisa las tarifas si no es intencionado.
      </p>
    </div>
  );
}
