// SOLO DEMO: verificación pública de la demo alojada (sin credenciales).
import { chromium, devices } from "playwright";
const { PORTAL, API } = process.env; const out = [];
const ck = (id, ok, d) => { out.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${id}${ok ? "" : " " + JSON.stringify(d).slice(0, 300)}`); };
const h = await fetch(API + "/health"); ck("P1 backend de la demo responde /health", h.ok, h.status);
const pre = await fetch(API + "/auth/login", { method: "OPTIONS", headers: { Origin: PORTAL, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
const preProd = await fetch(API + "/auth/login", { method: "OPTIONS", headers: { Origin: "https://app.etnaracare.com", "Access-Control-Request-Method": "POST" } });
ck("P2 el backend de la demo solo acepta el portal de la demo", pre.headers.get("access-control-allow-origin") === PORTAL && preProd.headers.get("access-control-allow-origin") !== "https://app.etnaracare.com", [pre.headers.get("access-control-allow-origin"), preProd.headers.get("access-control-allow-origin")]);
const idx = await fetch(PORTAL + "/family/today"); const html = await idx.text();
ck("P3 portal: enlaces directos funcionan (SPA), noindex y título DEMO", idx.ok && /DEMO · ETNARA Care/.test(html) && /noindex/.test(idx.headers.get("x-robots-tag") ?? ""), [idx.status, idx.headers.get("x-robots-tag")]);
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices["iPhone 14"], locale: "es-PR" }); const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(e.message)); let apiStatus = null;
p.on("response", (r) => { if (r.url().startsWith(API + "/auth/login")) apiStatus = r.status(); });
await p.goto(PORTAL + "/login"); await p.waitForTimeout(1500);
const banner = await p.locator("#etnara-demo-banner").isVisible(), badge = await p.locator("#etnara-demo-badge").isVisible();
const box = await p.locator("#etnara-demo-banner").boundingBox();
ck("P4 iPhone: franja DEMO arriba e insignia DEMO visibles", banner && badge && box && box.y <= 2, { banner, badge, box });
await p.locator('input[name="identifier"]').fill("central@demo.invalid"); await p.locator('input[name="password"]').fill("contraseña-incorrecta-de-prueba"); await p.locator('button[type="submit"]').first().click(); await p.waitForTimeout(2500);
ck("P5 iPhone: el portal habla con el backend de la demo (contraseña incorrecta → 401, sin error de conexión)", apiStatus === 401, apiStatus);
const prod = await (await fetch("https://app.etnaracare.com/")).text();
ck("P6 producción intacta: app.etnaracare.com no tiene nada de la demo", !/etnara-demo-banner|DEMO · ETNARA/.test(prod), null);
ck("P7 sin errores de página", errs.length === 0, errs);

// P8/P9: la versión publicada contiene los textos finales de la Fase 1 (#294 y #290), en la demo y en producción.
async function bundleText(base) {
  const html = await (await fetch(base + "/")).text(); const seen = new Set(); const queue = [...html.matchAll(/\/?assets\/[A-Za-z0-9_.-]+\.js/g)].map((m) => m[0].replace(/^\//, ""));
  let all = "";
  while (queue.length && seen.size < 400) { const a = queue.shift(); if (seen.has(a)) continue; seen.add(a); const t = await (await fetch(`${base}/${a}`)).text(); all += t; for (const m of t.matchAll(/assets\/[A-Za-z0-9_.-]+\.js/g)) if (!seen.has(m[0])) queue.push(m[0]); }
  return { all, n: seen.size };
}
const FINAL = ["Tu nombre profesional", "no requiere revisión de otra persona", "Aprobada por tu agencia", "requisitos revisados por la agencia"];
for (const [id, base] of [["P8 demo", PORTAL], ["P9 producción", "https://app.etnaracare.com"]]) {
  const { all, n } = await bundleText(base); const missing = FINAL.filter((t) => !all.includes(t));
  ck(`${id}: la versión publicada contiene los textos finales de #294 y #290`, missing.length === 0 && !all.includes("Cumple todos los requisitos verificados"), { n, missing });
}

// P10: el portal de la demo incluye las pantallas de hogares (F2 calendario y «Mi horario», F4 ponches, F3 vista previa).
{ const { all, n } = await bundleText(PORTAL); const want = ["Mi horario", "Ponchar", "Mis residentes"]; const missing = want.filter((t) => !all.includes(t));
  ck("P10 demo: el portal publicado incluye «Mi horario», «Ponchar» y «Mis residentes» (F3)", missing.length === 0, { n, missing }); }
await b.close(); const f = out.filter((x) => !x).length; console.log(`RESULTADO ${out.length - f}/${out.length}`); process.exit(f ? 1 : 0);
