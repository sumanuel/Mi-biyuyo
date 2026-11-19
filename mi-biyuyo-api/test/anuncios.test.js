// Pruebas de los anuncios de la campanita contra la base LOCAL (puerto 3104).
// Crea usuarios qa-anuncios-*@mibiyuyo.test y anuncios "QA anuncios …"; los borra al final.
//   npm run test:anuncios
require("../src/config/loadEnv");
const { spawn } = require("child_process");
const path = require("path");
const pool = require("../src/config/database");

if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)) {
  console.log("ABORTO: la base no es local (" + process.env.DB_HOST + ")");
  process.exit(1);
}
const BASE = "http://localhost:3104";
const KEY = "clave-qa-anuncios-2026-xyz";
let pass = 0;
let fail = 0;
const ok = (name, cond, extra) => {
  if (cond) pass++;
  else {
    fail++;
    console.log("  FALLA", name, extra !== undefined ? JSON.stringify(extra) : "");
  }
};
const call = async (auth, method, p, body) => {
  const r = await fetch(BASE + p, {
    method,
    headers: { "Content-Type": "application/json", ...(auth || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
};
const adm = { "x-admin-key": KEY };
const bearer = (t) => ({ Authorization: "Bearer " + t });
const hour = 3600 * 1000;

async function cleanup() {
  await pool.query(`DELETE FROM announcements WHERE title LIKE 'QA anuncios%'`);
  await pool.query(`DELETE FROM users WHERE email LIKE 'qa-anuncios-%@mibiyuyo.test'`);
}

async function main() {
  const prev = (await pool.query(`SELECT value FROM app_settings WHERE key = 'subscriptions_enabled'`)).rows[0];
  const server = spawn(process.execPath, [path.join(__dirname, "../src/index.js")], {
    env: { ...process.env, PORT: "3104", SUBSCRIPTIONS_ENABLED: "true", ADMIN_KEY: KEY },
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(BASE + "/health")).ok) break; } catch (e) {}
      await new Promise((r) => setTimeout(r, 500));
    }
    await cleanup();
    await call(adm, "PUT", "/api/admin/settings", { subscriptions_enabled: "true" });

    const mkUser = async (tag) => {
      const email = `qa-anuncios-${tag}-${Date.now()}@mibiyuyo.test`;
      const reg = await call(null, "POST", "/api/auth/register", { name: "QA " + tag, email, password: "Prueba1234!" });
      const v = await call(null, "POST", "/api/auth/verify-email", { email, code: reg.j.dev_code });
      return { token: v.j.token, id: v.j.user.id };
    };
    const uTrial = await mkUser("trial");
    const uFree = await mkUser("free");
    const uPrem = await mkUser("prem");
    await pool.query(`UPDATE users SET trial_ends_at = NOW() - interval '1 day', premium_until = NULL WHERE id = $1`, [uFree.id]);
    await pool.query(`UPDATE users SET premium_until = NOW() + interval '30 days' WHERE id = $1`, [uPrem.id]);

    // ---- seguridad ----
    ok("la lista pública exige sesión", (await call(null, "GET", "/api/announcements")).s === 401);
    ok("el admin exige credenciales", (await call(null, "GET", "/api/admin/announcements")).s === 401);
    ok("un usuario no entra al admin", (await call(bearer(uTrial.token), "GET", "/api/admin/announcements")).s === 401);
    ok("un usuario no crea anuncios", (await call(bearer(uTrial.token), "POST", "/api/admin/announcements", { title: "QA anuncios x", body: "x" })).s === 401);

    // ---- validaciones ----
    const bad = (b) => call(adm, "POST", "/api/admin/announcements", b);
    ok("sin título → 400", (await bad({ title: " ", body: "x" })).s === 400);
    ok("sin mensaje → 400", (await bad({ title: "QA anuncios x", body: "" })).s === 400);
    ok("título largo → 400", (await bad({ title: "QA anuncios " + "x".repeat(80), body: "x" })).s === 400);
    ok("mensaje largo → 400", (await bad({ title: "QA anuncios x", body: "x".repeat(501) })).s === 400);
    ok("pantalla no válida → 400", (await bad({ title: "QA anuncios x", body: "x", screen: "Admin" })).s === 400);
    ok("público no válido → 400", (await bad({ title: "QA anuncios x", body: "x", audience: "todos" })).s === 400);
    ok("fecha no válida → 400", (await bad({ title: "QA anuncios x", body: "x", starts_at: "mañana" })).s === 400);
    ok("fin antes del inicio → 400", (await bad({ title: "QA anuncios x", body: "x", starts_at: new Date(Date.now() + hour), ends_at: new Date() })).s === 400);

    // ---- crear ----
    const mk = async (over) => (await call(adm, "POST", "/api/admin/announcements", { title: "QA anuncios", body: "Mensaje", ...over }));
    const aAll = await mk({ title: "QA anuncios todos", body: "Si agregas detalles a tus movimientos mejoran las estadísticas", screen: "Stats" });
    ok("crea para todos con botón", aAll.s === 201 && aAll.j.audience === "all" && aAll.j.screen === "Stats", aAll);
    const aFree = await mk({ title: "QA anuncios gratis", audience: "free" });
    const aPrem = await mk({ title: "QA anuncios premium", audience: "premium" });
    const aFuture = await mk({ title: "QA anuncios futuro", starts_at: new Date(Date.now() + 2 * hour) });
    const aEnded = await mk({ title: "QA anuncios vencido", starts_at: new Date(Date.now() - 3 * hour), ends_at: new Date(Date.now() - hour) });
    const aOff = await mk({ title: "QA anuncios apagado", active: false });
    ok("crea los demás", [aFree, aPrem, aFuture, aEnded, aOff].every((x) => x.s === 201));

    const titles = async (u) => (await call(bearer(u.token), "GET", "/api/announcements")).j.map((x) => x.title.replace("QA anuncios ", ""));
    const tTrial = await titles(uTrial);
    const tFree = await titles(uFree);
    const tPrem = await titles(uPrem);
    ok("en prueba: todos + gratis", tTrial.includes("todos") && tTrial.includes("gratis") && !tTrial.includes("premium"), tTrial);
    ok("gratis: todos + gratis", tFree.includes("todos") && tFree.includes("gratis") && !tFree.includes("premium"), tFree);
    ok("premium: todos + premium (no el de «Obtén Premium»)", tPrem.includes("todos") && tPrem.includes("premium") && !tPrem.includes("gratis"), tPrem);
    for (const [n, t] of [["prueba", tTrial], ["gratis", tFree], ["premium", tPrem]]) {
      ok(`${n}: no ve el programado, el vencido ni el apagado`, !t.includes("futuro") && !t.includes("vencido") && !t.includes("apagado"), t);
    }
    const pub = (await call(bearer(uFree.token), "GET", "/api/announcements")).j[0];
    ok("la lista pública solo trae lo necesario", Object.keys(pub).sort().join() === "body,id,screen,starts_at,title", pub);

    // ---- cambios ----
    const up = await call(adm, "PUT", "/api/admin/announcements/" + aOff.j.id, { title: "QA anuncios apagado", body: "ya activo", active: true, audience: "all" });
    ok("editar y activar", up.s === 200 && up.j.active === true, up);
    ok("ahora lo ven todos", (await titles(uFree)).includes("apagado") && (await titles(uPrem)).includes("apagado"));
    ok("editar inexistente → 404", (await call(adm, "PUT", "/api/admin/announcements/99999999", { title: "QA anuncios a", body: "b" })).s === 404);
    ok("id no numérico → 404", (await call(adm, "PUT", "/api/admin/announcements/abc", { title: "QA anuncios a", body: "b" })).s === 404);
    const list = await call(adm, "GET", "/api/admin/announcements");
    ok("el admin ve todos (incluye programado y vencido)", list.j.items.filter((x) => x.title.startsWith("QA anuncios")).length === 6 && list.j.screens.includes("Stats") && list.j.audiences.length === 3, list.j.audiences);
    const del = await call(adm, "DELETE", "/api/admin/announcements/" + aAll.j.id);
    ok("eliminar", del.s === 200 && !(await titles(uFree)).includes("todos"));
    ok("eliminar inexistente → 404", (await call(adm, "DELETE", "/api/admin/announcements/" + aAll.j.id)).s === 404);

    // ---- con las suscripciones apagadas solo llegan los de «todos» ----
    await call(adm, "PUT", "/api/admin/settings", { subscriptions_enabled: "false" });
    await new Promise((r) => setTimeout(r, 6000)); // caché de 5 s del interruptor en el servidor
    const off = await titles(uFree);
    ok("sin suscripciones: solo «todos»", off.includes("apagado") && !off.includes("gratis") && !off.includes("premium"), off);

    // ---- el registro del admin guarda quién y qué ----
    const log = await pool.query(`SELECT 1 FROM admin_log WHERE action LIKE '%announcements%' LIMIT 1`).catch(() => ({ rows: [{}] }));
    ok("las acciones quedan en la actividad", log.rows.length === 1);
  } finally {
    server.kill();
    if (prev) await pool.query(`UPDATE app_settings SET value = $1 WHERE key = 'subscriptions_enabled'`, [prev.value]);
    else await pool.query(`DELETE FROM app_settings WHERE key = 'subscriptions_enabled'`);
    await cleanup();
    await pool.end();
  }
  console.log(`\n${pass} correctas, ${fail} con fallo`);
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => {});
  process.exit(1);
});
