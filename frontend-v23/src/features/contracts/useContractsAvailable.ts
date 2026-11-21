import { useEffect, useState } from "react";
import { getToken } from "@/auth/token";
import { contractsApi, type ContractStatus } from "@/api/contracts";

/**
 * ¿Mostrar «Contratos» en el menú? Solo a la administración y solo si el servidor tiene el módulo
 * encendido (con el módulo apagado responde 404 y aquí no aparece nada).
 * 153: también trae el estado contractual. Solo cuando el SERVIDOR declara la restricción activa
 * (interruptor global encendido + modo y fecha fijados por ETNARA) el portal reacciona; hoy el
 * interruptor está apagado, así que `restricted` siempre llega en falso y nada cambia.
 */
export function useContractsAvailable(organizationId: string | undefined, isAdmin: boolean, featureOn = true): { available: boolean; pending: number; status: ContractStatus | null; readOnly: boolean } {
  const [state, setState] = useState<{ available: boolean; pending: number; status: ContractStatus | null; readOnly: boolean }>({ available: false, pending: 0, status: null, readOnly: false });
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!organizationId || !isAdmin || !token) { setState({ available: false, pending: 0, status: null, readOnly: false }); return; }
    // 157: con «Contratos» apagado para la agencia, solo consulta de constancias anteriores (si las hay).
    if (!featureOn) {
      contractsApi.acceptances(organizationId, token)
        .then((h) => { if (!cancelled) setState({ available: h.acceptances.length > 0, pending: 0, status: null, readOnly: true }); })
        .catch(() => { if (!cancelled) setState({ available: false, pending: 0, status: null, readOnly: true }); });
      return () => { cancelled = true; };
    }
    contractsApi.list(organizationId, token)
      .then(async (r) => {
        const pending = r.contracts.filter((c) => c.acceptance === "pending").length;
        const status = await contractsApi.status(organizationId, token).then((s) => s.status).catch(() => null);
        if (!cancelled) setState({ available: true, pending, status, readOnly: false });
      })
      .catch(() => { if (!cancelled) setState({ available: false, pending: 0, status: null, readOnly: false }); });
    return () => { cancelled = true; };
  }, [organizationId, isAdmin, featureOn]);
  return state;
}

/** Redirigir a Contratos solo si el servidor dice «solo contrato» y restricción activa. */
export function contractOnlyRedirect(status: ContractStatus | null, pathname: string): boolean {
  return !!status && status.serverEnforcementEnabled && status.restricted && status.mode === "contract_only" && !pathname.startsWith("/agency/contracts");
}
