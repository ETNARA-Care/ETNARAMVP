import { createContext, useContext, useState, type ReactNode } from "react";

export type ShiftStage = "not_started" | "checkin_pin" | "active" | "completed";

interface ShiftState {
  stage: ShiftStage;
  loggedEvents: string[];
}

interface ShiftContextValue extends ShiftState {
  startCheckIn: () => void;
  confirmPin: () => void;
  logEvent: (label: string) => void;
  finishShift: () => void;
  reset: () => void;
}

const ShiftContext = createContext<ShiftContextValue | null>(null);

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<ShiftStage>("not_started");
  const [loggedEvents, setLoggedEvents] = useState<string[]>([]);

  const value: ShiftContextValue = {
    stage,
    loggedEvents,
    startCheckIn: () => setStage("checkin_pin"),
    confirmPin: () => setStage("active"),
    logEvent: (label) => setLoggedEvents((prev) => [...prev, label]),
    finishShift: () => setStage("completed"),
    reset: () => {
      setStage("not_started");
      setLoggedEvents([]);
    },
  };

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be used within ShiftProvider");
  return ctx;
}
