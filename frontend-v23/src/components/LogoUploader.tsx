import { useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Reusable logo picker (first used by Facturación → Datos de facturación).
 *
 * Checks in the phone only what saves a pointless upload (type and the 5 MB limit);
 * the server still decides the real type by its bytes, optimises the image (≤ 800 px,
 * proportions and transparency kept, no metadata) and stores only that version.
 * The preview always comes from the server copy (read with the session, never a
 * public link). All texts come from the caller, so each module keeps its own i18n.
 */
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_EXT = /\.(png|jpe?g|webp)$/i;

export type LogoCheck = { ok: true } | { ok: false; reason: "type" | "size" };
/** iPhone files sometimes arrive without a type: the extension is then enough for this first check. */
export function checkLogoFile(file: Pick<File, "name" | "type" | "size">): LogoCheck {
  const typeOk = file.type ? ALLOWED_TYPES.includes(file.type.toLowerCase()) : ALLOWED_EXT.test(file.name);
  if (!typeOk) return { ok: false, reason: "type" };
  if (file.size > LOGO_MAX_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}
export const fileSizeLabel = (bytes: number, locale: string) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(locale)} KB`;

export interface LogoUploaderTexts {
  alt: string; empty: string; upload: string; replace: string; hint: string; uploading: string;
  wrongType: string; tooLarge: (size: string) => string;
}

export function LogoUploader({ id, previewUrl, hasLogo, canEdit, disabled, locale, texts, onUpload, onRejected }: {
  id: string; previewUrl: string | null; hasLogo: boolean; canEdit: boolean; disabled?: boolean; locale: string;
  texts: LogoUploaderTexts;
  /** Sends the file; resolves when the server has stored the optimised version. */
  onUpload: (file: File) => Promise<void>;
  onRejected: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    const check = checkLogoFile(file);
    if (!check.ok) {
      onRejected(check.reason === "type" ? texts.wrongType : texts.tooLarge(fileSizeLabel(file.size, locale)));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try { await onUpload(file); } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3" data-logo-uploader>
      <div className="relative flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-ivory-50)] bg-[length:12px_12px] [background-image:linear-gradient(45deg,var(--color-ivory-100)_25%,transparent_25%,transparent_75%,var(--color-ivory-100)_75%),linear-gradient(45deg,var(--color-ivory-100)_25%,transparent_25%,transparent_75%,var(--color-ivory-100)_75%)] [background-position:0_0,6px_6px]">
        {previewUrl
          ? <img src={previewUrl} alt={texts.alt} className="max-h-full max-w-full object-contain" data-logo-preview />
          : !busy && <span className="px-2 text-center text-xs text-[var(--color-text-muted)]">{texts.empty}</span>}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/75" aria-hidden>
            <Loader2 size={18} className="animate-spin text-[var(--color-navy-700)]" />
          </span>
        )}
      </div>
      {canEdit && (
        <div className="min-w-0 flex-1">
          <input ref={inputRef} type="file" accept={LOGO_ACCEPT} className="sr-only" id={id} data-logo-input
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
          <Button size="sm" variant="secondary" icon={<ImageUp size={15} />} loading={busy} disabled={busy || disabled}
            onClick={() => inputRef.current?.click()} data-logo-button>
            {hasLogo ? texts.replace : texts.upload}
          </Button>
          <p className="mt-1 text-xs leading-4 text-[var(--color-text-muted)]" role={busy ? "status" : undefined}>{busy ? texts.uploading : texts.hint}</p>
        </div>
      )}
    </div>
  );
}
