import { useState } from "react";
import type { ReactElement } from "react";
import type { DemoTimelineEvent, TimelineEventType } from "../demoData/timeline";
import {
  MapPinIcon,
  MealIcon,
  HydrationIcon,
  ActivityIcon,
  MoodIcon,
  CameraIcon,
  CheckIcon,
  AlertIcon,
} from "./icons";

const iconByType: Record<TimelineEventType, (props: { size?: number; color?: string }) => ReactElement> = {
  check_in: MapPinIcon,
  meal: MealIcon,
  hydration: HydrationIcon,
  activity: ActivityIcon,
  mood: MoodIcon,
  photo: CameraIcon,
  check_out: CheckIcon,
  observation: AlertIcon,
};

export function Timeline({ events }: { events: DemoTimelineEvent[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div style={{ position: "relative", paddingLeft: 28 }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 13,
          top: 8,
          bottom: 8,
          width: 2,
          background: "var(--color-border)",
        }}
      />
      {events.map((evt) => {
        const Icon = iconByType[evt.type];
        const expanded = expandedId === evt.id;
        return (
          <div key={evt.id} style={{ position: "relative", marginBottom: "var(--space-5)" }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: -28,
                top: 2,
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--color-surface)",
                border: "2px solid var(--color-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={13} color="var(--color-ink)" />
            </div>
            <button
              onClick={() => setExpandedId(expanded ? null : evt.id)}
              aria-expanded={expanded}
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--fs-mono)",
                    color: "var(--color-ink-soft)",
                  }}
                >
                  {evt.time}
                </span>
                <span style={{ fontWeight: 600, fontSize: "var(--fs-body)" }}>{evt.title}</span>
              </div>
              <p
                style={{
                  margin: 0,
                  color: "var(--color-ink-soft)",
                  fontSize: "var(--fs-body)",
                }}
              >
                {evt.detail}
              </p>
              {expanded && evt.worker && (
                <p style={{ margin: "6px 0 0", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)" }}>
                  Registrado por {evt.worker}
                </p>
              )}
              {evt.hasPhoto && (
                <div
                  style={{
                    marginTop: 8,
                    height: 120,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-surface-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-ink-soft)",
                    fontSize: "var(--fs-caption)",
                    gap: 6,
                  }}
                >
                  <CameraIcon size={16} />
                  Foto compartida (demo)
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
