import { useEffect, useRef, useSyncExternalStore } from "react";
import { isViewerOpen, refreshInterval, shouldRefreshOnReturn, subscribeViewer } from "./familyRefresh";

/**
 * Actualiza una pantalla del Portal Familiar: al montarla, cada 30 s (10 s con
 * el visor de fotos abierto), nunca con la app oculta, y en seguida al volver.
 */
export function useFamilyRefresh(load: () => Promise<void> | void): void {
  const viewerOpen = useSyncExternalStore(subscribeViewer, isViewerOpen, () => false);
  const loadRef = useRef(load);
  const lastLoadAt = useRef(0);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Primera carga y cada vez que cambia lo que se carga (familiar elegido, etc.).
  useEffect(() => {
    void Promise.resolve().then(() => { lastLoadAt.current = Date.now(); return load(); });
  }, [load]);

  useEffect(() => {
    const run = () => { lastLoadAt.current = Date.now(); void loadRef.current(); };
    const interval = window.setInterval(() => { if (document.visibilityState !== "hidden") run(); }, refreshInterval(viewerOpen));
    const onReturn = () => {
      if (document.visibilityState === "hidden") return;
      if (shouldRefreshOnReturn(lastLoadAt.current, Date.now())) run();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [viewerOpen]);
}
