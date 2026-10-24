import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import { getAccountSecurity, type AccountSecurity } from "@/api/accountSecurity";

/**
 * Account security state. Any failure (old server without the route, no signal)
 * means «nothing to show»: the app never blocks or nags because of this call.
 */
export function useAccountSecurity(enabled = true) {
  const [security, setSecurity] = useState<AccountSecurity | null>(null);
  const [loaded, setLoaded] = useState(false);
  // 404: a server without this feature yet (the app can ship before it).
  const [notSupported, setNotSupported] = useState(false);
  const reload = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoaded(true); return; }
    try { setSecurity(await getAccountSecurity(token)); }
    catch (error) { setSecurity(null); setNotSupported((error as ApiError)?.status === 404); }
    finally { setLoaded(true); }
  }, []);
  // Re-enabled (e.g. back from /security after linking): forget the old answer first, so a stale
  // «phone required» never bounces the person back while the new one loads.
  useEffect(() => { if (enabled) { setSecurity(null); void reload(); } }, [enabled, reload]);
  return { security, loaded, notSupported, reload };
}
