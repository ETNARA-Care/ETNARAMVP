import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const client = read("../src/api/client.ts");
const detail = read("../src/pages/caregiver/CaregiverShiftDetailPage.tsx");
const notifications = read("../src/api/notifications.ts");
const bell = read("../src/features/notifications/NotificationBell.tsx");

test("API errors keep the server's errorId only when it looks like a reference id", () => {
  assert.match(client, /errorId\?:string;/);
  assert.match(client, /const ERROR_ID=\/\^\[0-9a-f-\]\{36\}\$\/i;/);
  assert.equal((client.match(/errorId:errorIdOf\((body|responseBody)\)/g) ?? []).length, 2);
});

test("the caregiver sees a short reference for unexpected errors, nothing else from the server", () => {
  assert.match(detail, /if \(apiError\.errorId\) return `No pudimos registrar la acción\. Intenta nuevamente\. Código: \$\{apiError\.errorId\.slice\(0, 8\)\}`;/);
  assert.doesNotMatch(detail, /apiError\.message/);
});

test("agency notice for visits longer than 48 h, linked to the shift", () => {
  assert.match(notifications, /type === "TIMESHEET_NEEDS_REVIEW"\) return "Visita de más de 48 h: revisa las horas"/);
  assert.match(bell, /type === "TIMESHEET_NEEDS_REVIEW"\) && shiftId\) \{\s+navigate\(`\/agency\/shifts\/\$\{shiftId\}`\);/);
});
