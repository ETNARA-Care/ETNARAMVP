import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, BellOff, Moon, Share, Smartphone } from "lucide-react";
import { Badge, Button, Card, Checkbox, Input, useToast } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { pushApi, type PushConfig, type PushPreferences } from "@/api/push";
import type { PushAvailability } from "./pushSupport";
import { validQuietRange } from "./pushSupport";
import { currentAvailability, disablePushOnThisDevice, enablePushOnThisDevice } from "./pushDevice";

/**
 * «Notificaciones en este teléfono» (Web Push, Backend 146). Se usa igual en los tres portales.
 * - Nunca pide permiso al abrir la pantalla: solo al tocar «Activar notificaciones».
 * - iPhone en Safari: explica cómo añadir ETNARA a la pantalla de inicio.
 * - Bloqueadas: explica cómo activarlas en Ajustes (la web no puede volver a pedirlo).
 * - Silencio nocturno por persona; supervisión: decide si recibe los avisos de la agencia.
 */
export function NotificationSettingsCard() {
  const { t } = useTranslation("common");
  const { show } = useToast();
  const { user } = useAuth();
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [availability, setAvailability] = useState<PushAvailability | null>(null);
  const [prefs, setPrefs] = useState<PushPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [quietError, setQuietError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return null;
    const [cfg, avail, p] = await Promise.all([
      pushApi.config(token).catch(() => ({ enabled: false, publicKey: null })),
      currentAvailability().catch(() => "unsupported" as const),
      pushApi.preferences(token).catch(() => null),
    ]);
    return { cfg, avail, p };
  }, []);
  const apply = (r: Awaited<ReturnType<typeof load>>) => { if (r) { setConfig(r.cfg); setAvailability(r.avail); setPrefs(r.p); } };
  const refresh = useCallback(async () => apply(await load()), [load]);
  useEffect(() => {
    let alive = true;
    load().then((r) => { if (alive) apply(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, [load]);

  async function enable() {
    const token = getToken();
    if (!token || !config?.publicKey || !user) return;
    setBusy(true);
    // Sin esperas antes del permiso: iOS lo exige como respuesta directa al toque.
    const result = await enablePushOnThisDevice(config.publicKey, token, user.id);
    setBusy(false);
    if (result === "enabled") show(t("push.enabledToast"), "success");
    else if (result === "denied") show(t("push.deniedToast"), "danger");
    else show(t("push.errorToast"), "danger");
    await refresh();
  }

  async function disable() {
    setBusy(true);
    await disablePushOnThisDevice(getToken());
    setBusy(false);
    show(t("push.disabledToast"), "success");
    await refresh();
  }

  async function sendTest() {
    const token = getToken();
    if (!token) return;
    try { await pushApi.test(token); show(t("push.testSent"), "success"); }
    catch (e) { show((e as { status?: number }).status === 429 ? t("push.testWait") : t("push.errorToast"), "danger"); }
  }

  async function savePrefs(next: Pick<PushPreferences, "quietEnabled" | "quietStart" | "quietEnd" | "agencyAlerts">) {
    const token = getToken();
    if (!token) return;
    if (!validQuietRange(next.quietStart, next.quietEnd)) { setQuietError(t("push.quietInvalid")); return; }
    setQuietError(null);
    try { setPrefs(await pushApi.savePreferences(next, token)); show(t("push.saved"), "success"); }
    catch { show(t("push.errorToast"), "danger"); }
  }

  if (!config || !availability) return null;
  // Apagado en el servidor (PUSH_ENABLED=off o sin claves): la tarjeta no aparece.
  if (!config.enabled) return null;

  const base = prefs ? { quietEnabled: prefs.quietEnabled, quietStart: prefs.quietStart, quietEnd: prefs.quietEnd, agencyAlerts: prefs.agencyAlerts } : null;

  return (
    <Card className="space-y-4" data-testid="push-settings">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-[var(--color-navy-800)]" aria-hidden><Smartphone size={20} /></span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium text-[var(--text-body)] text-[var(--color-text-primary)]">{t("push.title")}</h2>
            {availability === "enabled" && <Badge tone="success">{t("push.badgeOn")}</Badge>}
            {availability === "denied" && <Badge tone="warning">{t("push.badgeBlocked")}</Badge>}
          </div>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("push.description")}</p>
        </div>
      </div>

      {availability === "available" && (
        <Button icon={<Bell size={17} />} loading={busy} onClick={() => void enable()} data-testid="push-enable">{t("push.enable")}</Button>
      )}
      {availability === "enabled" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void sendTest()} data-testid="push-test">{t("push.test")}</Button>
          <Button variant="ghost" icon={<BellOff size={17} />} loading={busy} onClick={() => void disable()} data-testid="push-disable">{t("push.disable")}</Button>
        </div>
      )}
      {availability === "ios-needs-install" && (
        <div className="rounded-xl bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)] text-[var(--color-text-secondary)]" data-testid="push-ios-install">
          <p className="font-medium text-[var(--color-text-primary)]">{t("push.iosTitle")}</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>{t("push.iosStep1")} <Share size={14} className="inline align-[-2px]" aria-hidden /></li>
            <li>{t("push.iosStep2")}</li>
            <li>{t("push.iosStep3")}</li>
          </ol>
          <p className="mt-1">{t("push.iosVersion")}</p>
        </div>
      )}
      {availability === "denied" && (
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]" data-testid="push-denied">{t("push.deniedHelp")}</p>
      )}
      {availability === "unsupported" && (
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]" data-testid="push-unsupported">{t("push.unsupported")}</p>
      )}

      {base && (
        <div className="space-y-3 border-t border-[var(--color-border)] pt-3">
          {prefs?.agencyRole && (
            <Checkbox
              label={prefs.agencyRole === "admin" ? t("push.agencyAlertsAdmin") : t("push.agencyAlertsSupervisor")}
              checked={prefs.agencyAlertsEffective}
              onChange={(e) => void savePrefs({ ...base, agencyAlerts: e.currentTarget.checked })}
              data-testid="push-agency-alerts"
            />
          )}
          <Checkbox
            label={t("push.quietLabel")}
            checked={base.quietEnabled}
            onChange={(e) => void savePrefs({ ...base, quietEnabled: e.currentTarget.checked })}
            data-testid="push-quiet"
          />
          {base.quietEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <Input type="time" label={t("push.quietFrom")} defaultValue={base.quietStart}
                onBlur={(e) => void savePrefs({ ...base, quietStart: e.currentTarget.value })} />
              <Input type="time" label={t("push.quietTo")} defaultValue={base.quietEnd}
                onBlur={(e) => void savePrefs({ ...base, quietEnd: e.currentTarget.value })} />
            </div>
          )}
          {quietError && <p role="alert" className="text-[var(--text-caption)] text-[var(--color-danger-700)]">{quietError}</p>}
          <p className="flex items-start gap-2 text-[var(--text-caption)] text-[var(--color-text-muted)]">
            <Moon size={14} className="mt-0.5 shrink-0" aria-hidden />{t("push.privacyNote")}
          </p>
        </div>
      )}
    </Card>
  );
}
