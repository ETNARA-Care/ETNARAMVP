import { useRef, useState, type ClipboardEvent } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { resolveMapLink } from "@/api/serviceLocations";
import { getToken } from "@/auth/token";
import { Button } from "@/components/ui";
import { addressFromText, type AddressHint } from "./addressHint";
import { parseMapInput, type MapPoint, type MapSource } from "./mapLinks";

const SOURCE: Record<MapSource, string> = { apple: "Apple Maps", google: "Google Maps", waze: "Waze", coordinates: "las coordenadas" };
type Tone = "ok" | "info" | "error";

/**
 * «Pegar ubicación» (Gate 6): paste what a maps app shares — a link from Apple Maps,
 * Google Maps or Waze, coordinates, or a written address.
 *  - Links and coordinates are read on this phone. Only a SHORT link (which hides its
 *    destination) is expanded by ETNARA's server, with a strict allowlist.
 *  - A point is never invented: a written address fills the fields and the person
 *    places the PIN; nothing is marked as verified or confirmed here.
 */
export function PasteLocation({ onPoint, onAddress, label = "Dirección o enlace de mapas" }: {
  onPoint: (point: MapPoint) => void;
  /** Address text found in what was pasted (fills the form; the person reviews it). */
  onAddress?: (hint: AddressHint) => void;
  label?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: Tone; message: string } | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);

  const say = (tone: Tone, message: string) => setStatus({ tone, message });
  const applyHint = (hint: string | null) => { if (hint && onAddress) onAddress(addressFromText(hint)); };

  async function interpret(raw: string) {
    const r = parseMapInput(raw);
    switch (r.kind) {
      case "empty":
        return say("info", "Pega una dirección, un enlace de Apple Maps, Google Maps o Waze, o unas coordenadas.");
      case "point":
        onPoint(r.point); applyHint(r.placeHint);
        return say("ok", `Ubicación encontrada en ${SOURCE[r.source]}. Revisa el PIN en el mapa antes de confirmar.`);
      case "outside-pr":
        return say("error", "Esa ubicación está fuera de Puerto Rico. Revisa el enlace o colócala en el mapa.");
      case "unsupported-link":
        return say("error", "Solo aceptamos enlaces de Apple Maps, Google Maps o Waze. También puedes escribir la dirección.");
      case "text": {
        const hint = addressFromText(r.text);
        onAddress?.(hint);
        return say("info", `Usamos la dirección escrita${hint.municipality ? ` (${hint.municipality})` : ""}. No sabemos el punto exacto: toca «Ajustar PIN» y colócalo en la entrada.`);
      }
      case "no-point":
        applyHint(r.placeHint);
        return say("info", `El enlace de ${SOURCE[r.source]} no trae el punto exacto${r.placeHint ? `; usamos «${r.placeHint}» como dirección` : ""}. En la app, toca el lugar exacto y vuelve a compartirlo, o coloca el PIN con «Ajustar PIN».`);
      case "short-link": {
        const token = getToken();
        if (!token) return say("error", "Tu sesión terminó. Vuelve a entrar.");
        setBusy(true); setStatus(null);
        try {
          const res = await resolveMapLink(r.url, token);
          if (res.status === "point") {
            onPoint(res.point); applyHint(r.placeHint ?? res.placeHint);
            return say("ok", `Ubicación encontrada en ${r.source === "apple" ? "Apple Maps" : "Google Maps"}. Revisa el PIN en el mapa antes de confirmar.`);
          }
          if (res.status === "outside-pr") return say("error", "Esa ubicación está fuera de Puerto Rico.");
          applyHint(r.placeHint); // the shared text still fills the address; the person places the PIN
          if (res.status === "no-point") return say("info", "Ese enlace no trae el punto exacto. En la app, toca el lugar exacto y vuelve a compartirlo, o coloca el PIN con «Ajustar PIN».");
          return say("error", "No pudimos leer ese enlace corto. Copia las coordenadas desde la app (mantén presionado el lugar) o coloca el PIN con «Ajustar PIN».");
        } catch (e) {
          applyHint(r.placeHint);
          return say("error", (e as { status?: number })?.status === 429
            ? "Demasiados enlaces seguidos. Espera unos minutos o coloca el PIN con «Ajustar PIN»."
            : "No pudimos leer ese enlace ahora. Coloca el PIN con «Ajustar PIN» o inténtalo de nuevo.");
        } finally { setBusy(false); }
      }
    }
  }

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard?.readText?.();
      if (clip == null) throw new Error("no clipboard");
      setText(clip);
      await interpret(clip);
    } catch {
      field.current?.focus();
      say("info", "Toca el campo y elige «Pegar».");
    }
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;
    e.preventDefault();
    setText(pasted);
    void interpret(pasted);
  }

  const tone = status?.tone === "ok" ? "text-[var(--color-success-700)]" : status?.tone === "error" ? "text-[var(--color-danger-700)]" : "text-[var(--color-text-secondary)]";
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-ivory-50)] p-3" data-ui="paste-location">
      <label htmlFor="paste-location-input" className="text-[var(--text-small)] font-medium text-[var(--color-text-primary)]">{label}</label>
      <textarea id="paste-location-input" ref={field} rows={2} value={text} maxLength={2000}
        onChange={(e) => { setText(e.target.value); setStatus(null); }} onPaste={onPaste}
        placeholder="Pega aquí el enlace que compartiste desde Apple Maps, Google Maps o Waze, o escribe la dirección"
        autoComplete="off" autoCapitalize="none" spellCheck={false}
        className="min-h-[3.25rem] w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-navy-700)]" />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button type="button" variant="secondary" icon={<ClipboardPaste size={17} />} disabled={busy} onClick={() => void pasteFromClipboard()} className="whitespace-nowrap">Pegar ubicación</Button>
        <Button type="button" disabled={busy || !text.trim()} onClick={() => void interpret(text)} className="min-w-[5.5rem]">{busy ? <Loader2 size={17} className="animate-spin" aria-label="Leyendo el enlace" /> : "Usar"}</Button>
      </div>
      <p role="status" aria-live="polite" data-ui="paste-location-status" className={`min-h-[1.25rem] text-[var(--text-small)] ${tone}`}>
        {busy ? "Leyendo el enlace…" : status?.message ?? "Los enlaces se leen en tu teléfono. Nunca marcamos una ubicación como confirmada sin ti."}
      </p>
    </div>
  );
}
