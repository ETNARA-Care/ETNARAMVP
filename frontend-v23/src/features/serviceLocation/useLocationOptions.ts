import { useEffect, useState } from "react";
import { getToken } from "@/auth/token";
import { shiftLocationOptions, type ShiftLocationOption } from "@/api/serviceLocations";

/** Addresses of one person to choose from when creating a shift (managers only). */
export function useLocationOptions(organizationId: string | undefined, recipientId: string) {
  const [state, setState] = useState<{ key: string; options: ShiftLocationOption[] | null }>({ key: "", options: null });
  const key = `${organizationId ?? ""}:${recipientId}`;
  useEffect(() => {
    const token = getToken();
    if (!organizationId || !recipientId || !token) return;
    let active = true;
    shiftLocationOptions(organizationId, recipientId, token)
      .then((options) => { if (active) setState({ key, options }); })
      .catch(() => { if (active) setState({ key, options: [] }); });
    return () => { active = false; };
  }, [organizationId, recipientId, key]);
  return state.key === key ? state.options : null;
}
