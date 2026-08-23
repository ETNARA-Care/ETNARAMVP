import type { ReactNode } from "react";

export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        color: "var(--color-ink-soft)",
        gap: 12,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "3px solid var(--color-border)",
          borderTopColor: "var(--color-ink)",
          animation: "etnara-spin 0.8s linear infinite",
        }}
      />
      <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-body)" }}>{label}</span>
      <style>{"@keyframes etnara-spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--color-ink-soft)" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-title)", color: "var(--color-ink)", margin: "0 0 6px" }}>
        {title}
      </p>
      {description && <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-body)", margin: "0 0 16px" }}>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Algo salió mal",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        textAlign: "center",
        padding: "32px 20px",
        background: "var(--color-critical-bg)",
        borderRadius: "12px",
        margin: "20px",
      }}
    >
      <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-title)", color: "var(--color-critical)", margin: "0 0 6px" }}>
        {title}
      </p>
      {description && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-body)", color: "var(--color-ink-soft)", margin: "0 0 16px" }}>
          {description}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-body)",
            background: "var(--color-ink)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function UnauthorizedState({ message = "No tienes acceso a esta información." }: { message?: string }) {
  return (
    <div role="alert" style={{ textAlign: "center", padding: "32px 20px" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-title)", color: "var(--color-ink)", margin: "0 0 6px" }}>
        Acceso no autorizado
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-body)", color: "var(--color-ink-soft)" }}>{message}</p>
    </div>
  );
}

export function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
      <label
        htmlFor={id}
        style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", fontWeight: 600 }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-body-lg)",
          padding: "12px 14px",
          borderRadius: "8px",
          border: `1px solid ${error ? "var(--color-critical)" : "var(--color-border)"}`,
          background: "var(--color-surface)",
          color: "var(--color-ink)",
        }}
      />
      {error && (
        <span
          id={`${id}-error`}
          role="alert"
          style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-critical)" }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
