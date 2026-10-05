import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getOperationsCenter, type OperationsCenter } from "@/api/operations";

/** Lee el Centro operacional real de la organización activa (mismo contrato que /agency/operations). */
export function useOperationsCenter() {
 const { activeOrganization } = useAuth();
 const organizationId = activeOrganization?.id;
 const [data, setData] = useState<OperationsCenter | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(false);

 const reload = useCallback(async () => {
 const token = getToken();
 if (!organizationId || !token) return;
 try {
 const center = await getOperationsCenter(organizationId, token);
 setData(center);
 setError(false);
 } catch {
 setData(null);
 setError(true);
 } finally {
 setLoading(false);
 }
 }, [organizationId]);

 useEffect(() => {
 const task = window.setTimeout(() => void reload(), 0);
 return () => window.clearTimeout(task);
 }, [reload]);
 return { data, loading, error, reload };
}
