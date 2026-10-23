import { useEffect, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { getToken } from "@/auth/token";
import { getShiftPrivateInstructions, saveShiftPrivateInstructions } from "@/api/shifts";
import { Button, Card, Textarea, useToast } from "@/components/ui";

/**
 * Instrucciones operativas privadas del turno (migración 099). El servidor solo
 * las entrega a administradores y supervisores de la agencia y a la cuidadora
 * asignada; familiares y ETNARA central nunca las reciben.
 */
export function ShiftPrivateInstructions({ organizationId, shiftId, editable }: { organizationId: string; shiftId: string; editable: boolean }) {
  const { show } = useToast();
  const [text, setText] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let active = true;
    getShiftPrivateInstructions(organizationId, shiftId, token)
      .then((row) => { if (active) setText(row?.instructions ?? null); })
      .catch(() => { if (active) setText(null); });
    return () => { active = false; };
  }, [organizationId, shiftId]);

  async function save() {
    const token = getToken();
    if (!token || !draft.trim()) return;
    setSaving(true);
    try {
      const row = await saveShiftPrivateInstructions(organizationId, shiftId, draft.trim(), token);
      setText(row.instructions); setEditing(false);
      show("Instrucciones guardadas.", "success");
    } catch { show("No se pudieron guardar las instrucciones.", "danger"); }
    finally { setSaving(false); }
  }

  if (text === undefined || (!text && !editable)) return null;
  return (
    <Card className="flex flex-col gap-2" aria-label="Instrucciones operativas">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]"><Lock size={18} aria-hidden /> Instrucciones operativas</p>
        {editable && !editing && <Button size="md" variant="ghost" icon={<Pencil size={16} />} onClick={() => { setDraft(text ?? ""); setEditing(true); }}>{text ? "Editar" : "Añadir"}</Button>}
      </div>
      {!editing && (text
        ? <p className="whitespace-pre-line text-[var(--text-small)] text-[var(--color-text-primary)]">{text}</p>
        : <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Sin instrucciones.</p>)}
      {editing && <>
        <Textarea label="Instrucciones" rows={4} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={saving} onClick={() => setEditing(false)}>Cancelar</Button>
          <Button loading={saving} disabled={!draft.trim()} onClick={() => void save()}>Guardar</Button>
        </div>
      </>}
      <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Privadas: solo la agencia y la cuidadora asignada.</p>
    </Card>
  );
}
