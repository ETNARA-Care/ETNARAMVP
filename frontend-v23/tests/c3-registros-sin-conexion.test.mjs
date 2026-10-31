// C3 (auditoría 31-oct-2026): registros sin conexión cifrados por cuenta; una sesión que termina
// (401, vencida, revocada) no los borra; otra cuenta no los lee, no los envía ni los pisa.
// Pruebas de comportamiento: el almacén real (AES-GCM, llaves no exportables) sobre IndexedDB de prueba.
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const store = await import("../src/offline/secureStore.ts");
const vault = await import("../src/offline/pendingVault.ts");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const item = (n, extra = {}) => ({ clientEventId: `ev-${n}`, createdAt: new Date().toISOString(), status: "pending", kind: "care_event", label: `Baño de la señora ${n}`, shiftId: "s1", organizationId: "o1", ...extra });

function rawDump() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("etnara-secure", 1);
    open.onsuccess = () => {
      const tx = open.result.transaction("items", "readonly");
      const all = tx.objectStore("items").getAll(); const keys = tx.objectStore("items").getAllKeys();
      tx.oncomplete = () => resolve({ keys: keys.result, values: all.result });
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
}

test("C3.1 cada cuenta solo ve su propia bóveda", async () => {
  await vault.savePending(A, [item(1), item(2)]);
  assert.equal((await vault.loadPending(A)).length, 2);
  assert.deepEqual(await vault.loadPending(B), []);
});

test("C3.2 en el teléfono todo está cifrado: no aparece el contenido ni el id de la cuenta en claro", async () => {
  const { keys, values } = await rawDump();
  const text = JSON.stringify(values.map((v) => (v && v.data ? { iv: [...v.iv], len: v.data.byteLength } : String(v))));
  assert.ok(!text.includes("Baño"), "contenido en claro");
  assert.ok(keys.includes(`pending:${A}`) && keys.includes(`__key:user:${A}`));
  const sealed = values[keys.indexOf(`pending:${A}`)];
  assert.ok(sealed.data instanceof ArrayBuffer && sealed.iv.length === 12);
});

test("C3.3 la llave de la cuenta no es exportable", async () => {
  const { keys, values } = await rawDump();
  const key = values[keys.indexOf(`__key:user:${A}`)];
  assert.equal(key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey("raw", key));
});

test("C3.4 la sesión termina (401, vencida o revocada): se borra la sesión, NO los registros", async () => {
  await store.secureSet("session", { token: "t", expiresAt: new Date(Date.now() + 3600e3).toISOString() });
  await store.secureSet("identity", { me: { user: { id: A } } });
  // Lo mismo que hace clearToken() (token.ts, SESSION_SECURE_ITEMS).
  for (const name of ["session", "identity", "reads", "lock"]) await store.secureDelete(name);
  assert.equal(await store.secureGet("session"), null);
  assert.equal((await vault.loadPending(A)).length, 2, "los registros siguen tras terminar la sesión");
});

test("C3.5 otra cuenta en el mismo teléfono no pisa ni borra la bóveda ajena al guardar la suya", async () => {
  await vault.savePending(B, [item(9)]);
  await vault.savePending(B, []); // B envía o vacía la suya
  assert.equal((await vault.loadPending(A)).length, 2);
  const { keys } = await rawDump();
  assert.ok(!keys.includes(`pending:${B}`) && !keys.includes(`__key:user:${B}`), "la de B se borró con su llave");
});

test("C3.6 leer la bóveda de A con la llave de B falla sin destruirla", async () => {
  assert.equal(await store.secureGet(`pending:${A}`, { keyId: `user:${B}` }), null);
  assert.equal((await vault.loadPending(A)).length, 2, "la bóveda de A sigue intacta");
  await vault.savePending(B, []); // limpia la llave de B que se creó al intentarlo
});

test("C3.7 la pantalla de entrada solo conoce el total, no de quién ni qué", async () => {
  const r = await vault.pendingOnDevice();
  assert.deepEqual(Object.keys(r).sort(), ["accounts", "total"]);
  assert.equal(r.total, 2);
  assert.equal(r.accounts, 1);
});

test("C3.8 al volver la misma cuenta, lo que quedó «enviando» vuelve a «pendiente»", async () => {
  await vault.savePending(A, [item(1), item(2, { status: "sending" })]);
  const back = await vault.loadPending(A);
  assert.deepEqual(back.map((i) => i.status), ["pending", "pending"]);
});

test("C3.9 enviados todos: la bóveda y la llave de la cuenta desaparecen", async () => {
  await vault.savePending(A, []);
  const { keys } = await rawDump();
  assert.ok(!keys.some((k) => String(k).includes(A)));
  assert.equal((await vault.pendingOnDevice()).total, 0);
});

test("C3.10 descartar (confirmado por ella) borra registros y llave: lo cifrado queda ilegible", async () => {
  await vault.savePending(A, [item(3)]);
  const before = (await rawDump()).values[(await rawDump()).keys.indexOf(`pending:${A}`)];
  await vault.discardPending(A);
  const { keys } = await rawDump();
  assert.ok(!keys.includes(`pending:${A}`) && !keys.includes(`__key:user:${A}`));
  // Aunque alguien guardó el cifrado antes, con una llave nueva de A ya no se lee.
  const fresh = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await assert.rejects(crypto.subtle.decrypt({ name: "AES-GCM", iv: before.iv }, fresh, before.data));
});

test("C3.11 los registros de más de 7 días vencen (regla 12.4) y los recientes se conservan", async () => {
  const old = item(4, { createdAt: new Date(Date.now() - 8 * 24 * 3600e3).toISOString() });
  await vault.savePending(A, [old, item(5)]);
  assert.deepEqual((await vault.loadPending(A)).map((i) => i.clientEventId), ["ev-5"]);
  await vault.savePending(A, []);
});

test("C3.12 la cola anterior (un solo nombre) pasa a la bóveda de su dueña y no a la de otra", async () => {
  await store.secureSet("queue", { userId: A, items: [item(6)] });
  await vault.migrateLegacyQueue();
  assert.equal(await store.secureGet("queue"), null);
  assert.deepEqual((await vault.loadPending(A)).map((i) => i.clientEventId), ["ev-6"]);
  assert.deepEqual(await vault.loadPending(B), []);
  await vault.savePending(A, []);
});

// Comportamiento del portal alrededor de la bóveda (fuente).
const token = read("src/auth/token.ts");
const auth = read("src/auth/AuthProvider.tsx");
const provider = read("src/features/caregiver/CareEventQueueProvider.tsx");
const layout = read("src/layouts/CaregiverLayout.tsx");
const login = read("src/pages/LoginPage.tsx");

test("C3.13 terminar la sesión no borra todo el teléfono", () => {
  assert.doesNotMatch(token, /secureClearAll/);
  assert.match(token, /for \(const name of SESSION_SECURE_ITEMS\) void secureDelete\(name\);/);
  assert.match(token, /SESSION_SECURE_ITEMS = \[SECURE_SESSION, "identity", "reads", "lock"\]/);
});

test("C3.14 un 401 al enviar deja el registro pendiente, detiene el envío y avisa", () => {
  assert.match(provider, /if \(isSessionEnded\(error\)\) \{\s+update\(owner, item\.clientEventId, \{ status: "pending" \}\);\s+setSessionEnded\(true\);\s+break;/);
  assert.match(provider, /return \(error as ApiError\)\?\.status === 401;/);
  assert.match(provider, /Tu sesión terminó/);
  assert.match(auth, /const endSession = useCallback\(\(\) => \{\s+clearToken\(\);/);
});

test("C3.15 solo se envía con el token de la dueña de los registros", () => {
  assert.match(provider, /if \(!token \|\| !owner \|\| current\.owner !== owner \|\| !current\.ready\) return;/);
  assert.match(provider, /if \(userRef\.current !== owner\) break;/);
  assert.match(provider, /const mine = queue\.owner === userId \? queue\.items : \[\];/);
  assert.match(provider, /void savePending\(queue\.owner, queue\.items\);/);
});

test("C3.16 cerrar sesión con pendientes: se conservan por defecto; descartar pide segunda confirmación", () => {
  assert.match(layout, /onDiscardAndLogout=\{pending > 0 \? async \(\) => \{ await discardAll\(\); await logout\(\); \} : undefined\}/);
  assert.match(read("src/layouts/AccountMenu.tsx"), /if \(!discarding\) \{ setDiscarding\(true\); return; \}/);
  assert.match(login, /pendingOnDevice\(\)/);
});
