import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const forgot = read("../src/pages/ForgotPasswordPage.tsx");
const reset = read("../src/pages/ResetPasswordPage.tsx");
const sms = read("../src/features/accountSecurity/SmsRecovery.tsx");
const fields = read("../src/features/accountSecurity/PhoneFields.tsx");
const format = read("../src/features/accountSecurity/phoneFormat.ts");
const gate = read("../src/features/accountSecurity/PhoneRequirement.tsx");
const hook = read("../src/features/accountSecurity/useAccountSecurity.ts");
const menu = read("../src/layouts/AccountMenu.tsx");

test("/security is signed-in only and every signed-in route goes through the phone requirement", () => {
  assert.match(app, /<Route element=\{<ProtectedRoute\/>\}><Route element=\{<PhoneRequirement\/>\}><Route path="\/security" element=\{<AccountSecurityPage\/>\}\/>/);
  assert.match(menu, /navigate\("\/security"\)/);
  assert.match(menu, /Seguridad de la cuenta/);
});

test("nothing changes while SMS is off: SMS only when the server offers it, never block on errors", () => {
  assert.match(forgot, /const \[smsAvailable, setSmsAvailable\] = useState\(false\);/);
  assert.match(forgot, /setSmsAvailable\(o\.sms === true\)/);
  assert.match(forgot, /\{!sent && smsAvailable && \(/);
  assert.match(gate, /security\?\.phoneVerificationAvailable && security\.phoneRequired/);
  assert.match(hook, /catch \(error\) \{ setSecurity\(null\);/);
});

test("SMS recovery never reveals an account and the token never goes in the URL", () => {
  assert.match(sms, /Si <strong[^>]*>\+1 \{formatPhone\(digits\)\}<\/strong> está verificado en una cuenta de ETNARA Care/);
  assert.match(sms, /navigate\("\/reset-password", \{ replace: true, state: \{ resetToken \} \}\)/);
  assert.doesNotMatch(sms, /reset-password\?token/);
  assert.match(reset, /window\.history\.replaceState\(\{ \.\.\.window\.history\.state, usr: null \}, "", window\.location\.pathname\)/);
});

test("phone and code fields open the right keypad and autofill", () => {
  assert.match(fields, /type="tel"/);
  assert.match(fields, /autoComplete="tel-national"/);
  assert.match(fields, /autoComplete="one-time-code"/);
  assert.match(fields, /inputMode="numeric"/);
  assert.match(format, /\^\[2-9\]\\d\{2\}\[2-9\]\\d\{6\}\$/);
});
