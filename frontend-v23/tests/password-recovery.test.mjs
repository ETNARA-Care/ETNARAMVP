import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const login = read("../src/pages/LoginPage.tsx");
const forgot = read("../src/pages/ForgotPasswordPage.tsx");
const reset = read("../src/pages/ResetPasswordPage.tsx");
const api = read("../src/api/auth.ts");

test("public routes and the login link exist (the e-mail points to /reset-password)", () => {
  assert.match(app, /<Route path="\/forgot-password" element=\{<ForgotPasswordPage\/>\}\/>/);
  assert.match(app, /<Route path="\/reset-password" element=\{<ResetPasswordPage\/>\}\/>/);
  // Public: declared before the protected block.
  assert.ok(app.indexOf('path="/reset-password"') < app.indexOf("<Route element={<ProtectedRoute/>}>"));
  assert.match(login, /<Link to="\/forgot-password"[^>]*>\s*¿Olvidaste tu contraseña\?\s*<\/Link>/);
  assert.match(api, /"\/auth\/password-reset\/request", \{ email \}/);
  assert.match(api, /"\/auth\/password-reset\/confirm", \{ token, password \}/);
});

test("the request screen never reveals whether an account exists", () => {
  assert.match(forgot, /Si ese correo está registrado en ETNARA Care, te enviamos un enlace/);
  // Only connection, rate-limit and malformed input are told apart; anything else = the same neutral screen.
  assert.match(forgot, /else setSent\(true\); \/\/ any other answer: same neutral message/);
  assert.doesNotMatch(forgot, /no existe|no encontramos|not found|404/i);
});

test("the reset link is single-use: token read once, removed from the address bar, format-checked", () => {
  assert.match(reset, /const TOKEN = \/\^\[0-9a-f\]\{64\}\$\/i;/);
  assert.match(reset, /window\.history\.replaceState\(window\.history\.state, "", window\.location\.pathname\)/);
  assert.match(reset, /const \[token\] = useState\(takeTokenFromUrl\);/);
  assert.match(reset, /apiError\.code === "INVALID_OR_EXPIRED_RESET_TOKEN"\) setState\("invalid"\)/);
  assert.doesNotMatch(reset, /localStorage|sessionStorage|console\./);
});

test("new password: 12–128 characters, confirmed; the local session is closed after the change", () => {
  assert.match(reset, /const ready = password\.length >= 12 && password\.length <= 128 && confirmation === password;/);
  assert.match(reset, /autoComplete="new-password"/);
  assert.match(reset, /if \(state === "done" && status === "authenticated"\) void logout\(\);/);
  assert.match(reset, /cerramos la sesión en todos tus dispositivos/);
});
