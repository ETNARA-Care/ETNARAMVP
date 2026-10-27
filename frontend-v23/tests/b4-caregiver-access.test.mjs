import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("B4: the caregiver can start a conversation only about people the backend authorizes", () => {
  const api = read("src/api/messaging.ts");
  const hook = read("src/features/messaging/useMessagingRecipients.ts");
  const panel = read("src/features/messaging/ConversationUI.tsx");
  const page = read("src/pages/caregiver/CaregiverSupportPages.tsx");
  assert.match(api, /\/conversations\/startable-recipients/);
  assert.match(hook, /export function useStartableRecipients\(\)/);
  assert.match(panel, /const startOptions = startRecipients \?\? recipients;/);
  assert.match(panel, /canStart && startOptions\.length > 0/);
  assert.match(page, /<RealMessagingPanel recipients=\{recipients\} startRecipients=\{startable\} canStart \/>/);
});

test("B4: the shift button opens that person's conversation, only with an accepted shift", () => {
  const detail = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.match(detail, /\{assignmentAccepted && shift\.care_recipient_id && startable\.some\(\(person\) => person\.id === shift\.care_recipient_id\) && \(/);
  assert.match(detail, /openRecipientConversation\(activeOrganization\.id, recipientId, token\)/);
  assert.match(detail, /navigate\(`\/caregiver\/messages\?thread=\$\{conversation\.id\}`\)/);
  assert.doesNotMatch(detail, /onClick=\{\(\) => navigate\("\/caregiver\/messages"\)\}/);
});

test("B4: a reschedule notice has its own text and opens the shift", () => {
  assert.match(read("src/api/notifications.ts"), /SHIFT_RESCHEDULED"\) return "La agencia cambió el horario de uno de tus turnos"/);
  assert.match(read("src/features/notifications/NotificationBell.tsx"), /type === "SHIFT_RESCHEDULED"\) && shiftId/);
});

test("B4: another agency's or a missing resident/shift shows «No encontrado», not a server error", () => {
  for (const page of ["src/pages/agency/AgencyResidentProfilePage.tsx", "src/pages/agency/AgencyShiftDetailPage.tsx"]) {
    assert.match(read(page), /setError\(!\(status === 403 \|\| status === 404\)\);/, page);
  }
});
