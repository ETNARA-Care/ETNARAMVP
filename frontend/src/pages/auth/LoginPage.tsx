import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { TextField } from "../../components/UiStates";
import { ApiError } from "../../api/client";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Ingresa tu correo/teléfono y contraseña.");
      return;
    }
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Correo/teléfono o contraseña incorrectos.");
      } else {
        setError("No pudimos iniciar sesión. Intenta de nuevo en unos momentos.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-card)",
          padding: "32px 28px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display-lg)", color: "var(--color-ink)", fontWeight: 600 }}>
            ETNARA Care
          </div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", marginTop: 4 }}>
            Infraestructura de confianza para el cuidado
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField id="identifier" label="Correo electrónico o teléfono" type="text" value={identifier} onChange={setIdentifier} autoComplete="username" required />
          <TextField id="password" label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />

          {error && (
            <p role="alert" style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-critical)", margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--fs-body-lg)",
              fontWeight: 600,
              background: "var(--color-ink)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "13px 20px",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
