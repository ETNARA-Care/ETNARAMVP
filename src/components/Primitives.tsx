import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const interactive = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-card)",
        padding: "var(--space-4)",
        cursor: interactive ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Avatar({
  initials,
  color,
  size = 56,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        fontSize: size / 2.6,
        color: "var(--color-ink)",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-5) var(--space-5) var(--space-3)",
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Volver"
          style={{
            width: "var(--tap-min)",
            height: "var(--tap-min)",
            border: "none",
            background: "transparent",
            borderRadius: "var(--radius-full)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-ink)",
          }}
        >
          ←
        </button>
      )}
      <div>
        <h1 style={{ fontSize: "var(--fs-display)" }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: 0, color: "var(--color-ink-soft)", fontSize: "var(--fs-caption)" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "ink",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "ink" | "critical";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: "var(--tap-min)",
        borderRadius: "var(--radius-md)",
        border: "none",
        background: disabled
          ? "var(--color-border)"
          : tone === "critical"
          ? "var(--color-critical)"
          : "var(--color-ink)",
        color: disabled ? "var(--color-ink-soft)" : "white",
        fontSize: "var(--fs-body-lg)",
        fontWeight: 600,
        padding: "0 var(--space-5)",
      }}
    >
      {children}
    </button>
  );
}
