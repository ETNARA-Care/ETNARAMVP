import type { ReactNode } from "react";

export type BadgeTone = "verified" | "warning" | "critical" | "neutral" | "active";

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "md";
}

const toneStyles: Record<BadgeTone, { bg: string; fg: string }> = {
  verified: { bg: "var(--color-verified-bg)", fg: "var(--color-verified)" },
  warning: { bg: "var(--color-warning-bg)", fg: "var(--color-warning)" },
  critical: { bg: "var(--color-critical-bg)", fg: "var(--color-critical)" },
  neutral: { bg: "var(--color-surface-muted)", fg: "var(--color-ink-soft)" },
  active: { bg: "var(--color-ink-tint)", fg: "var(--color-ink)" },
};

/**
 * The single consistent visual language for "Verified" (green + shield)
 * and every other state across the platform -- Family, Caregiver, and
 * Agency surfaces all reuse this exact component so the meaning of each
 * color never has to be relearned.
 */
export function Badge({ tone, children, icon, size = "md" }: BadgeProps) {
  const s = toneStyles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: s.bg,
        color: s.fg,
        borderRadius: "var(--radius-full)",
        padding: size === "md" ? "6px 14px" : "4px 10px",
        fontSize: size === "md" ? 14 : 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {children}
    </span>
  );
}
