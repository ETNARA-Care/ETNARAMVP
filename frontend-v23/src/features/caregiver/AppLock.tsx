import { useEffect, useRef, useState, type ReactNode } from "react";
import { Fingerprint, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isKeptSession } from "@/auth/token";
import { Button, Card, useToast } from "@/components/ui";
import { LOCK_AFTER_MS, biometricAvailable, disableLock, enableLock, lockEnabled, unlock } from "@/offline/appLock";
import { secureGet, secureSet } from "@/offline/secureStore";
import { useCareEventQueue } from "./careEventQueue";

/**
 * Cubre el portal del cuidador/a con una pantalla de bloqueo al abrir la app
 * y al volver después de 5 minutos sin usarla, si el bloqueo está activado.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const { items } = useCareEventQueue();
  const [state, setState] = useState<"checking" | "locked" | "open">(isKeptSession() ? "checking" : "open");
  const [failed, setFailed] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isKeptSession()) return;
    lockEnabled().then((enabled) => { if (!cancelled) setState(enabled ? "locked" : "open"); });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenAt.current = Date.now(); return; }
      const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      if (away < LOCK_AFTER_MS) return;
      lockEnabled().then((enabled) => { if (!cancelled && enabled) { setFailed(false); setState("locked"); } });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  async function tryUnlock() {
    setFailed(false);
    if (await unlock()) setState("open");
    else setFailed(true);
  }

  if (state === "checking") return <div className="min-h-dvh bg-[var(--color-ivory-50)]" />;

  // Bloqueada: el portal sigue montado pero oculto (no se pierde lo que se
  // estaba escribiendo y la cola sigue enviando en segundo plano).
  const pending = items.filter((item) => item.status !== "failed").length;
  return <>
    <div hidden={state === "locked"} aria-hidden={state === "locked"}>{children}</div>
    {state === "locked" && <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-[var(--color-navy-900)] px-6 text-center text-white">
      <img src="/etnara-mark.svg" alt="" className="h-14 w-14 rounded-2xl" />
      <div>
        <LockKeyhole size={28} aria-hidden className="mx-auto mb-3 text-white/70" />
        <h1 className="font-[var(--font-display)] text-2xl">ETNARA está bloqueada</h1>
        <p className="mt-2 text-sm text-white/70">Usa tu cara o tu huella para seguir.</p>
      </div>
      <button
        type="button"
        onClick={() => void tryUnlock()}
        className="flex min-h-14 w-full max-w-[320px] items-center justify-center gap-2 rounded-2xl bg-white px-5 text-base font-semibold text-[var(--color-navy-900)]"
      >
        <Fingerprint size={22} aria-hidden />Desbloquear
      </button>
      {failed && <p role="alert" className="text-sm text-amber-200">No se pudo verificar. Intenta otra vez.</p>}
      {!confirmLogout ? (
        <button type="button" className="min-h-11 text-sm text-white/70 underline" onClick={() => setConfirmLogout(true)}>Entrar con mi contraseña</button>
      ) : (
        <div className="w-full max-w-[320px] rounded-2xl bg-white/10 p-4 text-left text-sm">
          <p>Se cerrará la sesión en este teléfono y tendrás que entrar con tu correo y contraseña (necesitas señal).</p>
          {pending > 0 && <p className="mt-2 font-semibold text-amber-200">Tienes {pending === 1 ? "1 registro" : `${pending} registros`} sin enviar. Si cierras la sesión ahora se perderán.</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" className="min-h-11 flex-1 rounded-xl bg-white/15 font-semibold" onClick={() => setConfirmLogout(false)}>Volver</button>
            <button type="button" className="min-h-11 flex-1 rounded-xl bg-white font-semibold text-[var(--color-navy-900)]" onClick={() => void logout()}>Cerrar sesión</button>
          </div>
        </div>
      )}
    </div>}
  </>;
}

/** Activar o quitar el bloqueo, en "Más". Solo si el teléfono tiene Face ID / huella. */
export function AppLockSetting() {
  const { user, activeWorkerProfile } = useAuth();
  const { show } = useToast();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isKeptSession()) return;
    Promise.all([biometricAvailable(), lockEnabled()]).then(([canUse, on]) => {
      if (!cancelled) { setAvailable(canUse); setEnabled(on); }
    });
    return () => { cancelled = true; };
  }, []);

  if (!available) return null;

  async function toggle() {
    setBusy(true);
    if (enabled) {
      await disableLock();
      setEnabled(false);
      show("Bloqueo quitado.", "success");
    } else if (await enableLock(activeWorkerProfile?.displayName ?? user?.email ?? "Cuidador/a")) {
      setEnabled(true);
      show("Listo. La app pedirá tu cara o huella al abrirla.", "success");
    } else {
      show("No se pudo activar. Revisa que Face ID o la huella estén configurados en el teléfono.", "danger");
    }
    setBusy(false);
  }

  return (
    <Card className="flex items-center gap-3">
      <ShieldCheck size={22} aria-hidden className="shrink-0 text-[var(--color-navy-900)]" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--color-text-primary)]">Bloqueo con Face ID o huella</p>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{enabled ? "Activado. Se pide al abrir la app y después de 5 minutos sin usarla." : "Protege tus turnos si pierdes el teléfono."}</p>
      </div>
      <Button variant={enabled ? "secondary" : "primary"} loading={busy} onClick={() => void toggle()}>{enabled ? "Quitar" : "Activar"}</Button>
    </Card>
  );
}

const OFFER_DISMISSED = "lock-offer-dismissed";

/** Sugerencia única en "Mi día" para activar el bloqueo. */
export function AppLockOffer() {
  const { user, activeWorkerProfile } = useAuth();
  const { show } = useToast();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isKeptSession()) return;
    Promise.all([biometricAvailable(), lockEnabled(), secureGet<boolean>(OFFER_DISMISSED)]).then(([canUse, on, dismissed]) => {
      if (!cancelled) setVisible(canUse && !on && !dismissed);
    });
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  async function activate() {
    setBusy(true);
    const ok = await enableLock(activeWorkerProfile?.displayName ?? user?.email ?? "Cuidador/a");
    setBusy(false);
    if (ok) { setVisible(false); show("Listo. La app pedirá tu cara o huella al abrirla.", "success"); }
    else show("No se pudo activar. Puedes intentarlo luego en Más.", "danger");
  }
  function dismiss() {
    setVisible(false);
    void secureSet(OFFER_DISMISSED, true);
  }

  return (
    <Card className="flex flex-col gap-3 border-[var(--color-navy-900)]/20 bg-white p-4">
      <div className="flex items-start gap-3">
        <Fingerprint size={22} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-navy-900)]" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--color-navy-900)]">Protege la app con tu cara o huella</p>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Tu sesión se queda abierta para trabajar sin señal. Con el bloqueo, nadie más puede ver tus turnos si pierdes el teléfono.</p>
        </div>
        <button type="button" aria-label="Ahora no" className="-m-2 h-11 w-11 shrink-0 text-[var(--color-text-muted)]" onClick={dismiss}><X size={18} className="mx-auto" /></button>
      </div>
      <Button fullWidth loading={busy} onClick={() => void activate()}>Activar bloqueo</Button>
    </Card>
  );
}
