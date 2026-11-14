import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("conversations are named by resident, residents/families first then latest message, and show its time", () => {
  const panel = read("src/features/messaging/ConversationUI.tsx");
  assert.match(panel, /const titleOf = \(conversation: Conversation\) =>/);
  assert.match(panel, /<Avatar name=\{title\} size=\{44\} \/>/);
  // D4: conversaciones de residentes y familias primero; dentro de cada grupo, la más reciente.
  assert.match(panel, /if \(a\.direct !== b\.direct\) return a\.direct \? 1 : -1;\s*return b\.last\.localeCompare\(a\.last\);/);
  assert.match(panel, /\.sort\(conversationOrder\)/);
  assert.match(panel, /lastMessageTime\(last\.created_at\)/);
  assert.doesNotMatch(panel, /localStorage|sessionStorage/);
});

test("the agency can start a conversation about a resident through the backend", () => {
  const api = read("src/api/messaging.ts");
  assert.match(api, /\/care-recipients\/\$\{recipientId\}\/conversation`/);
  const panel = read("src/features/messaging/ConversationUI.tsx");
  assert.match(panel, /openRecipientConversation\(organizationId, startRecipient, token\)/);
  assert.match(panel, /Nuevo mensaje/);
  const agency = read("src/pages/agency/AgencySupportPages.tsx");
  assert.match(agency, /<RealMessagingPanel recipients=\{recipients\} canStart directTitle="caregiver" \/>/);
});

test("caregiver and family name conversations without a start button", () => {
  const caregiver = read("src/pages/caregiver/CaregiverSupportPages.tsx");
  // 151: sin «Nuevo mensaje» de residentes, pero con «Escribir a mi agencia».
  assert.match(caregiver, /<RealMessagingPanel recipients=\{recipients\} directTitle="agency" canWriteAgency \/>/);
  const family = read("src/pages/family/FamilyMessagesPage.tsx");
  assert.match(family, /useFamilyRecipient\(\)/);
  assert.doesNotMatch(family, /canStart/);
  const hook = read("src/features/messaging/useMessagingRecipients.ts");
  assert.match(hook, /listCareRecipients\(activeOrganization\.id, token\)/);
});

test("care quality runs its review when the page opens", () => {
  const page = read("src/pages/agency/AgencyCareQualityPage.tsx");
  assert.match(page, /useEffect\(\(\) => \{\s+const token = getToken\(\);/);
  assert.match(page, /generateCareQualityAgentBriefing\(organizationId, token\)\s+\.then/);
  assert.match(page, /No pudimos revisar la documentación ahora/);
});
