import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("A: a resident conversation falls back to the backend short name before the generic title", () => {
  const api = read("src/api/messaging.ts");
  assert.match(api, /care_recipient_name\?: string \| null;/);
  const panel = read("src/features/messaging/ConversationUI.tsx");
  assert.match(panel, /nameById\[conversation\.care_recipient_id\]\) \|\| conversation\.care_recipient_name \|\| conversationTitle/);
  // Direct agency/caregiver conversations keep their own title (never a resident name).
  assert.match(panel, /isDirect\(conversation\)\s*\n?\s*\? directNames\[conversation\.id\]/);
});

test("B: «Enviar mensaje sobre X» only when the backend allows writing about that person, and opens her conversation", () => {
  const api = read("src/api/messaging.ts");
  assert.match(api, /\/conversations\/startable-recipients`/);
  const page = read("src/pages/caregiver/CaregiverShiftDetailPage.tsx");
  assert.doesNotMatch(page, /onClick=\{\(\) => navigate\("\/caregiver\/messages"\)\}>Enviar mensaje sobre/);
  assert.match(page, /\{canMessage && shift\.care_recipient_id && <Button/);
  assert.match(page, /rows\.some\(\(row\) => row\.id === shiftRow\.care_recipient_id\)/);
  assert.match(page, /openRecipientConversation\(organizationId, recipientId, token\)/);
  assert.match(page, /navigate\(`\/caregiver\/messages\?thread=\$\{conversation\.id\}`\)/);
  // If access ended meanwhile (24 h), the button disappears instead of opening another conversation.
  assert.match(page, /catch \{\s*setCanMessage\(false\);/);
});
