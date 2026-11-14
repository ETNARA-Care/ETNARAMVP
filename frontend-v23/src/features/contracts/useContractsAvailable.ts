import { useEffect, useState } from "react";
import { getToken } from "@/auth/token";
import { contractsApi } from "@/api/contracts";

/**
 * ¿Mostrar «Contratos» en el menú? Solo a la administración y solo si el servidor tiene el módulo
 * encendido (con el módulo apagado responde 404 y aquí no aparece nada). Nunca bloquea otras pantallas.
 */
export function useContractsAvailable(organizationId: string | undefined, isAdmin: boolean): { available: boolean; pending: number } {
  const [state, setState] = useState({ available: false, pending: 0 });
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!organizationId || !isAdmin || !token) { setState({ available: false, pending: 0 }); return; }
    contractsApi.list(organizationId, token)
      .then((r) => { if (!cancelled) setState({ available: true, pending: r.contracts.filter((c) => c.acceptance === "pending").length }); })
      .catch(() => { if (!cancelled) setState({ available: false, pending: 0 }); });
    return () => { cancelled = true; };
  }, [organizationId, isAdmin]);
  return state;
}
