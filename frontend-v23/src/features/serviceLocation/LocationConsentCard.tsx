import { useCallback, useEffect, useState } from "react";
import { MapPinCheck } from "lucide-react";
import { getToken } from "@/auth/token";
import { getLocationConsent, grantLocationConsent, revokeLocationConsent } from "@/api/serviceLocations";
import { Badge, Button, Card, useToast } from "@/components/ui";

/** Caregiver profile: the separate, revocable consent for the arrival location check (Gate 6). */
export function LocationConsentCard({ organizationId }: { organizationId: string }) {
  const { show } = useToast();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try { setGranted((await getLocationConsent(organizationId, token)).granted); } catch { setGranted(null); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  async function toggle() {
    const token = getToken();
    if (!token || granted === null) return;
    setBusy(true);
    try {
      if (granted) { await revokeLocationConsent(organizationId, token); show("Permiso retirado. Tus llegadas se registrarán sin ubicación.", "success"); }
      else { await grantLocationConsent(organizationId, token); show("Permiso concedido.", "success"); }
    } catch { show("No se pudo cambiar el permiso.", "danger"); }
    finally { setBusy(false); await load(); }
  }

  return (
    <Card aria-label="Verificación de llegada">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <MapPinCheck size={20} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium text-[var(--color-text-primary)]">Verificación de llegada</p>
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Una sola lectura al tocar «Llegué». Sin seguimiento ni recorridos.</p>
          </div>
        </div>
        {granted !== null && <Badge tone={granted ? "success" : "neutral"}>{granted ? "Permitida" : "No permitida"}</Badge>}
      </div>
      {granted !== null && <Button className="mt-3" variant="secondary" fullWidth loading={busy} onClick={() => void toggle()}>
        {granted ? "Retirar permiso" : "Permitir verificación"}
      </Button>}
    </Card>
  );
}
