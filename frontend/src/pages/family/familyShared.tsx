import { useEffect, useMemo, useState } from "react";
import { Card, Avatar } from "../../components/Primitives";
import { listMyCareRecipients, type MyRecipient, type TimelineItem } from "../../api/familyRecipients";

export function familyDisplayName(recipient: MyRecipient): string {
  return `${recipient.preferredName ?? recipient.firstName} ${recipient.lastName}`;
}

export function familyInitials(recipient: MyRecipient): string {
  return `${recipient.firstName[0] ?? ""}${recipient.lastName[0] ?? ""}`.toUpperCase();
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `hace ${days} d`;
}

export function formatFamilyDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function useFamilyRecipients(activeOrganizationId?: string) {
  const [recipients, setRecipients] = useState<MyRecipient[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMyCareRecipients()
      .then((rows) => {
        if (cancelled) return;
        setRecipients(rows);
        setSelectedId((previous) => {
          if (previous && rows.some((row) => row.recipientId === previous)) return previous;
          const preferred = activeOrganizationId ? rows.find((row) => row.organizationId === activeOrganizationId) : null;
          return (preferred ?? rows[0])?.recipientId ?? null;
        });
        setError(null);
      })
      .catch(() => !cancelled && setError("No pudimos cargar tus familiares autorizados."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId]);

  const selected = useMemo(
    () => recipients?.find((recipient) => recipient.recipientId === selectedId) ?? null,
    [recipients, selectedId]
  );

  return { recipients, selected, selectedId, setSelectedId, error, loading };
}

export function FamilyRecipientPicker({
  recipients,
  selectedId,
  onSelect,
}: {
  recipients: MyRecipient[];
  selectedId: string | null;
  onSelect: (recipientId: string) => void;
}) {
  if (recipients.length <= 1) return null;

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
      {recipients.map((recipient) => {
        const active = selectedId === recipient.recipientId;
        return (
          <button
            key={recipient.recipientId}
            onClick={() => onSelect(recipient.recipientId)}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${active ? "var(--color-ink)" : "var(--color-border)"}`,
              background: active ? "var(--color-ink)" : "var(--color-surface)",
              color: active ? "#fff" : "var(--color-ink)",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {recipient.preferredName ?? recipient.firstName}
          </button>
        );
      })}
    </div>
  );
}

export function FamilyTimelineCard({ item }: { item: TimelineItem }) {
  return (
    <Card style={{ marginBottom: 12, borderRadius: "var(--radius-lg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-title)", color: "var(--color-ink)" }}>{item.title}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
          {timeAgo(item.occurredAt)}
        </span>
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-body)", color: "var(--color-ink)", margin: "0 0 8px" }}>
        {item.summary}
      </p>
      {item.type === "PHOTO" && !item.photo?.visible && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", fontStyle: "italic", margin: "0 0 8px" }}>
          Foto registrada — no disponible con tu nivel de acceso actual.
        </p>
      )}
      {item.caregiver.displayName && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", margin: 0 }}>
          Por {item.caregiver.displayName}
          {item.caregiver.role ? ` · ${item.caregiver.role}` : ""}
        </p>
      )}
    </Card>
  );
}

export function FamilyRecipientHero({
  recipient,
  eyebrow,
  title,
  detail,
}: {
  recipient: MyRecipient;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <Card
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5)",
        marginBottom: 18,
        background: "linear-gradient(180deg, var(--color-surface) 0%, var(--color-ink-tint) 100%)",
      }}
    >
      <Avatar initials={familyInitials(recipient)} color="var(--color-ink-tint)" />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {eyebrow}
        </p>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--fs-display)", color: "var(--color-ink)" }}>
          {familyDisplayName(recipient)}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: "var(--fs-body)", color: "var(--color-ink)" }}>{title}</p>
        <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>{detail}</p>
      </div>
    </Card>
  );
}
