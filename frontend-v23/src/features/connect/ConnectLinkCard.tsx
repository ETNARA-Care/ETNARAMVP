import { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { getToken } from "@/auth/token";
import { connectApi, type ConnectLinkCode, type ConnectLinkStatus } from "@/api/connect";
import { Badge, Button, Card, Modal, Skeleton, useToast } from "@/components/ui";

/**
 * 181 · ETNARA Connect en Configuración (solo administración; agencias y cuidadores independientes). El código se
 * muestra una sola vez y no se guarda en el navegador. Desvincular avisa a Connect al instante.
 */
export function ConnectLinkCard({ organizationId }: { organizationId: string }) {
  const { show } = useToast();
  const [state, setState] = useState<ConnectLinkStatus | null | "hidden" | "error">(null);
  const [code, setCode] = useState<ConnectLinkCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setState(await connectApi.status(organizationId, token)); }
    catch (e) { setState((e as { status?: number } | null)?.status === 404 ? "hidden" : "error"); }
  }, [organizationId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount, as the other panels
  useEffect(() => { void load(); }, [load]);
  if (state === "hidden") return null;

  async function generate() {
    const token = getToken(); if (!token) return;
    setBusy(true);
    try { setCode(await connectApi.createCode(organizationId, token)); }
    catch (e) { show((e as { code?: string } | null)?.code === "CONNECT_ORG_SUSPENDED" ? "La organización está suspendida: no se puede vincular." : "No se pudo generar el código.", "danger"); }
    finally { setBusy(false); }
  }
  async function unlink() {
    const token = getToken(); if (!token) return;
    setBusy(true);
    try { await connectApi.unlink(organizationId, token); setConfirmUnlink(false); setCode(null); show("ETNARA Connect quedó desvinculado.", "success"); await load(); }
    catch { show("No se pudo desvincular.", "danger"); }
    finally { setBusy(false); }
  }
  const expires = code ? new Date(code.expiresAt).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" }) : "";

  return (
    <Card aria-label="ETNARA Connect" data-testid="connect-link">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><Link2 size={20} aria-hidden /> ETNARA Connect</p>
        {state && typeof state === "object" && <Badge tone={state.linked ? "success" : "neutral"}>{state.linked ? "Vinculado" : "Sin vincular"}</Badge>}
      </div>
      <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">Recibe solicitudes de familias en ETNARA Connect. Las cuentas quedan vinculadas, no fusionadas: Connect solo sabe si tu organización está activa en Care, nunca datos de residentes ni de tu equipo.</p>
      {state === null ? <Skeleton className="mt-3 h-10" />
        : state === "error" ? <p className="mt-2 text-[var(--text-small)] text-[var(--color-danger-700)]">No se pudo cargar el estado.</p>
        : state.linked ? (
          <div className="mt-3 flex flex-col gap-2">
            {state.linkedAt && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Vinculado el {new Date(state.linkedAt).toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Puerto_Rico" })}.</p>}
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmUnlink(true)}>Desvincular</Button>
          </div>
        ) : code ? (
          <div className="mt-3 flex flex-col gap-2" role="status">
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Escribe este código en ETNARA Connect (Cuenta → ETNARA Care). Vence a las {expires} y sirve una sola vez.</p>
            <p className="font-mono text-[var(--text-h3)] tracking-widest text-[var(--color-text-primary)]" data-testid="connect-code">{code.code}</p>
            <Button variant="secondary" disabled={busy} onClick={() => void load()}>Ya lo usé</Button>
          </div>
        ) : (
          <div className="mt-3"><Button disabled={busy} onClick={() => void generate()}>Generar código para Connect</Button></div>
        )}
      <Modal open={confirmUnlink} onClose={() => !busy && setConfirmUnlink(false)} title="¿Desvincular ETNARA Connect?"
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setConfirmUnlink(false)}>Cancelar</Button><Button variant="danger" disabled={busy} onClick={() => void unlink()}>Sí, desvincular</Button></>}>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Tu organización dejará de recibir solicitudes nuevas en Connect de inmediato. Lo que ya está en curso con las familias no se borra.</p>
      </Modal>
    </Card>
  );
}
