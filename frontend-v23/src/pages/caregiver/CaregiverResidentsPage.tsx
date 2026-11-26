import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { useOrgFeature } from "@/auth/orgFeatures";
import { Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import type { CareEventTypeCode } from "@/api/careEvents";
import { useCareEventQueue } from "@/features/caregiver/careEventQueue";
import { ACTIVITY_OPTIONS, ACTIVITY_TYPES, activityInput, TYPE_FIELDS, valueKey, type OptionField } from "@/features/residential/activities";
import { assignmentsApi, type MyResident } from "@/api/residentialAssignments";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";
import { CAREGIVER_GUIDE_PATH, isResidentialOrganization } from "@/features/residential/modality";
import { GuideLink } from "@/features/residential/GuideLink";

/**
 * 176 (hogares F3): «Mis residentes». Solo hogares y solo con HOGAR_ASIGNACIONES. Lista lo que el backend devuelve:
 * los residentes asignados AHORA (por la RLS y la asignación activa), y hasta cuándo. Sin asignación, ninguno.
 * 177 (F5): registrar actividades no clínicas de cada residente asignado (con fecha, hora y autor, que pone el servidor).
 * Sin señal, el registro espera en la cola cifrada del teléfono y se envía al volver.
 */
const fmt = (iso: string, lang: string | undefined) => new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-PR", { timeZone: "America/Puerto_Rico", hour: "numeric", minute: "2-digit" });

export function CaregiverResidentsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const enabled = useOrgFeature("HOGAR_ASIGNACIONES");
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.resolvedLanguage;
  const [state, setState] = useState<OrganizationScoped<MyResident[]> | null>(null);
  const [recording, setRecording] = useState<{ organizationId: string; resident: MyResident } | null>(null);
  const latest = useRef(createLatestRequest());
  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential || !enabled) return;
    const request = latest.current.begin();
    try {
      const { residents } = await assignmentsApi.me(organizationId, token);
      if (request.isCurrent()) setState({ organizationId, data: residents, error: false });
    } catch {
      if (request.isCurrent()) setState({ organizationId, data: null, error: true });
    }
  }, [organizationId, residential, enabled]);
  useEffect(() => {
    const tracker = latest.current;
    void load();
    return () => tracker.invalidate();
  }, [load]);

  if (!residential || !enabled) return <Navigate to="/caregiver/today" replace />;
  const current = scopedTo(state, organizationId);
  const residents = current?.data ?? null;
  return (
    <div className="flex flex-col gap-5" data-testid="caregiver-residents">
      <PageHeader title={t("assignments.mine.title")} description={t("assignments.mine.description")} />
      <GuideLink to={CAREGIVER_GUIDE_PATH} />
      {current?.error ? <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} /> : residents === null ? <Skeleton className="h-32" /> : residents.length === 0 ? (
        <EmptyState title={t("assignments.mine.emptyTitle")} description={t("assignments.mine.emptyDetail")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {residents.map((r) => (
            <li key={`${r.shiftId}|${r.careRecipientId}`}><Card className="p-[var(--spacing-md)]">
              <p className="font-medium text-[var(--color-text-primary)]">{r.name}</p>
              <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("assignments.mine.until", { establishment: r.establishment, time: fmt(r.until, lang) })}</p>
              <div className="mt-3"><Button size="sm" variant="secondary" onClick={() => organizationId && setRecording({ organizationId, resident: r })}>{t("activities.record")}</Button></div>
            </Card></li>
          ))}
        </ul>
      )}
      {recording && recording.organizationId === organizationId && <ActivityDialog organizationId={recording.organizationId} resident={recording.resident} onClose={() => setRecording(null)} />}
    </div>
  );
}

function ActivityDialog({ organizationId, resident, onClose }: { organizationId: string; resident: MyResident; onClose: () => void }) {
  const { t } = useTranslation("residential");
  const toast = useToast();
  const queue = useCareEventQueue();
  const [type, setType] = useState<CareEventTypeCode>("MEAL");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const input = activityInput(type, values);
  const set = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!input) return;
    setSaving(true);
    try {
      const outcome = await queue.submit({ organizationId, shiftId: resident.shiftId, label: t(`activities.types.${type}`), input: { typeCode: type, careRecipientId: resident.careRecipientId, ...input } });
      toast.show(outcome === "queued" ? t("activities.queued") : t("activities.saved"), outcome === "queued" ? "warning" : "success");
      onClose();
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      toast.show(code === "EVENT_TYPE_NOT_ENABLED" ? t("activities.errors.notEnabled") : code === "RECIPIENT_NOT_IN_SHIFT_CONTEXT" ? t("activities.errors.notAssigned") : t("activities.errors.fallback"), "danger");
    } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={t("activities.title", { name: resident.name })} sheetOnMobile
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("assignments.cancel")}</Button>
        <Button disabled={saving || !input} onClick={() => void save()}>{t("activities.save")}</Button></div>}>
      <div className="flex flex-col gap-3" data-testid="activity-dialog">
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("activities.body")}</p>
        <Select label={t("activities.type")} value={type} onChange={(e) => { setType(e.target.value as CareEventTypeCode); setValues({}); }}>
          {ACTIVITY_TYPES.map((x) => <option key={x} value={x}>{t(`activities.types.${x}`)}</option>)}
        </Select>
        {TYPE_FIELDS[type].map((f) => f === "label" ? <Input key={f} label={t("activities.fields.label")} value={values.label ?? ""} maxLength={200} onChange={(e) => set("label", e.target.value)} />
          : f === "durationMinutes" ? <Input key={f} label={t("activities.fields.durationMinutes")} inputMode="numeric" value={values.durationMinutes ?? ""} onChange={(e) => set("durationMinutes", e.target.value.replace(/\D/g, ""))} />
          : f === "note" ? null
          : <Select key={f} label={t(`activities.fields.${f}`)} value={values[f] ?? ""} onChange={(e) => set(f, e.target.value)}>
              <option value="">{t("activities.choose")}</option>
              {(ACTIVITY_OPTIONS[f as OptionField] as readonly string[]).map((v) => <option key={v} value={v}>{(t as unknown as (k: string) => string)(`activities.values.${valueKey(v)}`)}</option>)}
            </Select>)}
        <Textarea label={type === "NOTE" ? t("activities.fields.note") : t("activities.fields.noteOptional")} value={values.note ?? ""} maxLength={type === "NOTE" ? 4000 : 1000}
          onChange={(e) => set("note", e.target.value)} hint={t("activities.nonClinicalHint")} />
      </div>
    </Modal>
  );
}
