import { apiFetch } from "./client";

export interface MyRecipient {
  organizationId: string;
  recipientId: string;
  relationshipType: string;
  canViewPhotos: boolean;
  firstName: string;
  lastName: string;
  preferredName: string | null;
}

export async function listMyCareRecipients(): Promise<MyRecipient[]> {
  const res = await apiFetch<{ recipients: MyRecipient[] }>("/me/care-recipients");
  return res.recipients;
}

export interface TimelineItem {
  id: string;
  type: string;
  occurredAt: string;
  title: string;
  summary: string;
  caregiver: { displayName: string | null; role: string | null };
  photo?: { visible: boolean; reference?: string };
}
export interface TimelineResult {
  items: TimelineItem[];
  nextCursor: string | null;
}

export async function getFamilyTimeline(
  organizationId: string,
  recipientId: string,
  opts: { cursor?: string; limit?: number } = {}
): Promise<TimelineResult> {
  return apiFetch<TimelineResult>(`/organizations/${organizationId}/care-recipients/${recipientId}/timeline`, {
    query: { cursor: opts.cursor, limit: opts.limit },
  });
}
