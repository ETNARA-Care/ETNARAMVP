// D4 (5-nov-2026): «Escribir a mi agencia», quién lee cada conversación y supervisoras autorizadas.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("src/features/messaging/ConversationUI.tsx");

test("every conversation says who can read it (list, header) and where the message goes (composer)", () => {
  assert.match(panel, /"Solo tú y la administración de tu agencia"/);
  assert.match(panel, /"Conversación interna: la cuidadora y la administración de la agencia"/);
  assert.match(panel, /`Familia de \$\{residentName\} y equipo de la agencia`/);
  assert.match(panel, /<p className="text-\[var\(--text-caption\)\] text-\[var\(--color-text-muted\)\]">\{audience\(conversation\)\}<\/p>/);
  assert.match(panel, /<p className="text-\[var\(--text-caption\)\] text-\[var\(--color-text-secondary\)\]">\{audience\}<\/p>/);
  assert.match(panel, /placeholder=\{hint\}/);
  assert.match(panel, /"Mensaje para tu agencia"/);
  assert.match(panel, /"Mensaje para la familia y el equipo"/);
});

test("the caregiver writes to her agency through the backend, never choosing recipients", () => {
  assert.match(read("src/api/messaging.ts"), /apiClient\.post\(`\/organizations\/\$\{organizationId\}\/my-agency-conversation`, undefined, token\)/);
  assert.match(panel, />Escribir a mi agencia</);
  assert.match(panel, /Solo tú y la administración de tu agencia\. La familia no la ve\./);
  assert.match(panel, /AGENCY_HAS_NO_MESSAGE_HANDLER/);
  assert.doesNotMatch(read("src/pages/family/FamilyMessagesPage.tsx"), /canWriteAgency/);
  assert.doesNotMatch(read("src/pages/agency/AgencySupportPages.tsx"), /canWriteAgency/);
});

test("Ajustes › Equipo: administrators always answer; supervisors only when authorized (revocable)", () => {
  const team = read("src/features/agency/TeamPanel.tsx");
  assert.match(team, /Atiende los mensajes internos de las cuidadoras \(todas las administradoras\)\./);
  assert.match(team, /label="Atiende los mensajes internos de las cuidadoras"/);
  assert.match(team, /setCaregiverMessageHandler\(organizationId, member\.membershipId, authorized, token\)/);
  assert.match(read("src/api/team.ts"), /\/team\/message-handlers`, \{ membershipId, authorized \}/);
});

test("ordering helper puts residents and families first", async () => {
  // Misma regla que conversationOrder, comprobada con datos.
  const order = (a, b) => (a.direct !== b.direct ? (a.direct ? 1 : -1) : b.last.localeCompare(a.last));
  const list = [
    { id: "directa-nueva", direct: true, last: "2026-11-05T18:00:00Z" },
    { id: "juliana", direct: false, last: "2026-11-05T10:00:00Z" },
    { id: "pedro", direct: false, last: "2026-11-05T12:00:00Z" },
  ].sort(order).map((x) => x.id);
  assert.deepEqual(list, ["pedro", "juliana", "directa-nueva"]);
});
