import { useEffect, useState } from "react";

/** «Reenviar código» available after the server's wait (60 s). */
export function useCountdown(seconds: number): [number, () => void] {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return [left, () => setLeft(seconds)];
}
