import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/auth/token";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/api/notifications";

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const page = await listMyNotifications(token);
      setItems(page.items);
      setError(false);
    } catch {
      setError(true);
      setItems((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void reload();
    const interval = window.setInterval(() => void reload(), 30_000);
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  const markRead = useCallback(async (notificationId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const updated = await markNotificationRead(notificationId, token);
      setItems((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? []);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      const readAt = new Date().toISOString();
      setItems((current) => current?.map((item) => ({ ...item, readAt: item.readAt ?? readAt })) ?? []);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  const unread = useMemo(() => items?.filter((item) => !item.readAt).length ?? 0, [items]);
  return { items, unread, error, reload, markRead, markAllRead };
}
