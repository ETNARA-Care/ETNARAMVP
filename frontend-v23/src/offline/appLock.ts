import { isKeptSession } from "@/auth/token";
import { secureDelete, secureGet, secureSet } from "./secureStore";

/**
 * Bloqueo con Face ID / huella (Phase 12.6, aprobado por Rafa 2026-10-23).
 *
 * Con la sesión de 7 días la app abre sin pedir nada; si alguien toma el
 * teléfono vería los turnos. El bloqueo usa la biometría del propio teléfono
 * (WebAuthn, autenticador de la plataforma, userVerification "required"):
 *
 * - Activar: se crea una credencial en el teléfono; su id se guarda cifrado.
 * - Desbloquear: el teléfono verifica la cara/huella. Funciona SIN señal
 *   porque la verificación la hace el teléfono, no el servidor. Es un
 *   bloqueo de pantalla: los datos ya están cifrados en el teléfono y el
 *   servidor sigue exigiendo la sesión en cada envío.
 * - Se pide al abrir la app y al volver después de 5 minutos sin usarla.
 * - Al terminar la sesión se borra con lo demás de la sesión (token.ts, SESSION_SECURE_ITEMS).
 *
 * Solo para sesiones de cuidador/a que se quedan en el teléfono.
 */
const SECURE_LOCK = "lock";
export const LOCK_AFTER_MS = 5 * 60 * 1000;

interface LockEnrollment {
  credentialId: string; // base64url
}

function toBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
function challenge(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)));
}

/** El teléfono tiene Face ID / huella disponible para esta página. */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return typeof PublicKeyCredential !== "undefined"
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function lockEnabled(): Promise<boolean> {
  if (!isKeptSession()) return false;
  return (await secureGet<LockEnrollment>(SECURE_LOCK)) !== null;
}

/** Activa el bloqueo: el teléfono pide la cara/huella una vez para crear la credencial. */
export async function enableLock(displayName: string): Promise<boolean> {
  if (!isKeptSession() || !(await biometricAvailable())) return false;
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge(),
        rp: { name: "ETNARA Care", id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))), name: displayName, displayName },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60_000,
        attestation: "none",
      },
    }) as PublicKeyCredential | null;
    if (!credential) return false;
    await secureSet(SECURE_LOCK, { credentialId: toBase64Url(credential.rawId) } satisfies LockEnrollment);
    return true;
  } catch {
    return false;
  }
}

export async function disableLock(): Promise<void> {
  await secureDelete(SECURE_LOCK);
}

/** Pide la cara/huella. true si el teléfono la verificó. */
export async function unlock(): Promise<boolean> {
  const enrollment = await secureGet<LockEnrollment>(SECURE_LOCK);
  if (!enrollment) return true;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge(),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: fromBase64Url(enrollment.credentialId), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null;
    if (!assertion) return false;
    const data = (assertion.response as AuthenticatorAssertionResponse).authenticatorData;
    // Bandera UV (bit 2): el teléfono confirmó que es la persona, no solo un toque.
    return toBase64Url(assertion.rawId) === enrollment.credentialId && (new Uint8Array(data)[32] & 0x04) !== 0;
  } catch {
    return false;
  }
}
