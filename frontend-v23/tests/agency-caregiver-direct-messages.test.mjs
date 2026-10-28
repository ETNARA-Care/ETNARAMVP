import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the agency admin starts a direct conversation from the caregiver profile", () => {
  const api = read("src/api/messaging.ts");
  assert.match(api, /\/workers\/\$\{workerMembershipId\}\/conversation`/);
  assert.match(api, /\/caregiver-conversations`/);
  const profile = read("src/pages/agency/AgencyWorkerProfilePage.tsx");
  assert.match(profile, /worker\.status === "active" && roles\.includes\("ORGANIZATION_ADMIN"\) && <Button.*?>Enviar mensaje<\/Button>/);
  assert.match(profile, /openCaregiverConversation\(organizationId, membershipId, token\)/);
  assert.match(profile, /navigate\(`\/agency\/messages\?thread=\$\{conversationId\}`\)/);
  assert.match(profile, /CAREGIVER_NO_ACCOUNT/);
});

test("direct conversations are named by caregiver (agency) or agency (caregiver), never by a resident", () => {
  const panel = read("src/features/messaging/ConversationUI.tsx");
  assert.match(panel, /conversation\.thread_type === "caregiver_agency"/);
  assert.match(panel, /directTitle === "agency" \? item\.organizationName : item\.caregiverName/);
  assert.match(panel, /listCaregiverConversations\(organizationId, token\)\.catch\(\(\) => \[\]\)/);
  assert.match(read("src/pages/agency/AgencySupportPages.tsx"), /directTitle="caregiver"/);
  assert.match(read("src/pages/caregiver/CaregiverSupportPages.tsx"), /directTitle="agency"/);
  assert.doesNotMatch(read("src/pages/family/FamilyMessagesPage.tsx"), /directTitle/);
});
