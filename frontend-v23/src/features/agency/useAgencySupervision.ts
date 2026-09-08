import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listRecipientCareEvents, type CareEvent } from "@/api/careEvents";
import {
  listAssignments,
  listCareRecipients,
  listShifts,
  listWorkers,
  type CareRecipient,
  type Shift,
  type WorkerMembership,
} from "@/api/shifts";

export interface AdminShift extends Shift {
  recipient?: CareRecipient;
  caregiver?: WorkerMembership;
}

export interface AdminCareEvent extends CareEvent {
  recipient?: CareRecipient;
  caregiver?: WorkerMembership;
}

interface AgencySupervisionState {
  loading: boolean;
  error: boolean;
  recipients: CareRecipient[];
  shifts: AdminShift[];
  events: AdminCareEvent[];
  reload: () => Promise<void>;
}

export function isToday(value: string): boolean {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

export function useAgencySupervision(): AgencySupervisionState {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recipients, setRecipients] = useState<CareRecipient[]>([]);
  const [shifts, setShifts] = useState<AdminShift[]>([]);
  const [events, setEvents] = useState<AdminCareEvent[]>([]);

  const reload = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setLoading(true);
    setError(false);
    try {
      const [recipientRows, workerRows, shiftRows] = await Promise.all([
        listCareRecipients(organizationId, token),
        listWorkers(organizationId, token),
        listShifts(organizationId, token),
      ]);
      const [assignmentRows, recipientEventRows] = await Promise.all([
        Promise.all(shiftRows.map(async (shift) => ({
          shiftId: shift.id,
          assignments: await listAssignments(organizationId, shift.id, token),
        }))),
        Promise.all(recipientRows.map(async (recipient) => ({
          recipientId: recipient.id,
          events: await listRecipientCareEvents(organizationId, recipient.id, token),
        }))),
      ]);

      const recipientById = Object.fromEntries(recipientRows.map((recipient) => [recipient.id, recipient]));
      const workerByMembershipId = Object.fromEntries(workerRows.map((worker) => [worker.id, worker]));
      const assigneeByShiftId = Object.fromEntries(assignmentRows.map(({ shiftId, assignments }) => [
        shiftId,
        workerByMembershipId[assignments[0]?.organization_worker_membership_id ?? ""],
      ]));

      setRecipients(recipientRows);
      setShifts(shiftRows.map((shift) => ({
        ...shift,
        recipient: recipientById[shift.care_recipient_id ?? ""],
        caregiver: assigneeByShiftId[shift.id],
      })));
      setEvents(recipientEventRows.flatMap(({ recipientId, events: rows }) => rows.map((event) => ({
        ...event,
        recipient: recipientById[recipientId],
        caregiver: workerByMembershipId[event.organization_worker_membership_id],
      }))));
    } catch {
      setRecipients([]);
      setShifts([]);
      setEvents([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void reload(); }, [reload]);

  return useMemo(() => ({ loading, error, recipients, shifts, events, reload }), [loading, error, recipients, shifts, events, reload]);
}
