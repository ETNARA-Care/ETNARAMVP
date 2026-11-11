import { Ban } from "lucide-react";
import { CLOSED_WITHOUT_SERVICE_LABEL } from "@/api/shiftClosures";

/** 154 — Identificación visual única de un turno con cierre sin servicio vigente. */
export function ClosedWithoutServiceBadge() {
  return (
    <span data-testid="closed-without-service-badge"
      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-ivory-100)] px-2.5 py-0.5 text-[var(--text-caption)] font-semibold text-[var(--color-text-primary)]">
      <Ban size={13} aria-hidden /> {CLOSED_WITHOUT_SERVICE_LABEL}
    </span>
  );
}
