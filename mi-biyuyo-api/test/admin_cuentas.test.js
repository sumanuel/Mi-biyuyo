// Pruebas de las cuentas de administrador (alta sin contraseña, código por correo, sesión, registro)
// contra la base LOCAL. Puertos 3106 (con clave de emergencia) y 3107 (sin ADMIN_KEY).
// Sin correo configurado, la API devuelve el código en `dev_code` (solo fuera de producción).
//   npm run test:admincuentas
require("../src/config/loadEnv");
const { spawn } = require("child_process");
const path = require("path");
const pool = require("../src/config/database");

if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)) {
  console.log("ABORTO: la base no es local (" + process.env.DB_HOST + ")");
  process.exit(1);
}
const KEY = "clave-de-prueba-0123456789";
const WITH = "http://localhost:3106";
const WITHOUT = "http://localhost:3107";
const TAG = "qa-admin-" + Date.now();
let pass = 0;
let fail = 0;
const ok = (name, cond, extra) => {
  if (cond) pass++;
  else {
    fail++;
    console.log("  FALLA", name, extra !== undefined ? JSON.stringify(extra) : "");
  }
};
const call = async (base, method, p, body, headers = {}) => {
  const r = await fetch(base + "/api/admin" + p, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch (e) {}
  return { s: r.status, j };
};
const withKey = (m, p, b) => call(WITH, m, p, b, { "x-admin-key": KEY });
const withToken = (t, base = WITH) => (m, p, b) => call(base, m, p, b, { Authorization: "Bearer " + t });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const servers = [];
const start = (port, env) =>
  servers.push(
    spawn(process.execPath, [path.join(__dirname, "../src/index.js")], {
      env: { ...process.env, PORT: String(port), ...env },
      stdio: "ignore",
    }),
  );
const waitFor = async (base) => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/health")).ok) return;
    } catch (e) {}
    await sleep(500);
  }
};
const cleanup = async () => {
  await pool.query(`DELETE FROM admin_users WHERE email LIKE 'qa-admin-%@mibiyuyo.test'`);
  await pool.query(`DELETE FROM admin_log WHERE admin_email LIKE 'qa-admin-%@mibiyuyo.test'`);
};
// Salta la espera de 60 s entre reenvíos (solo en la prueba)
const allowResend = (email) =>
  pool.query(`UPDATE admin_users SET reset_sent_at = NOW() - INTERVAL '2 minutes' WHERE email = $1`, [email]);

async function main() {
  await cleanup();
  const had = (await pool.query(`SELECT COUNT(*)::int n FROM admin_users WHERE active`)).rows[0].n;
  if (had > 0) {
    console.log("ABORTO: la base local ya tiene cuentas de administrador; la prueba necesita que no haya ninguna");
    process.exit(1);
  }
  start(3106, { ADMIN_KEY: KEY, NODE_ENV: "development" });
  start(3107, { ADMIN_KEY: "", NODE_ENV: "development" });
  try {
    await waitFor(WITH);
    await waitFor(WITHOUT);
    const e1 = `${TAG}-a@mibiyuyo.test`;
    const e2 = `${TAG}-b@mibiyuyo.test`;

    /* ---------- alta sin contraseña ---------- */
    ok("crear: correo inválido → 422", (await withKey("POST", "/admins", { email: "x", name: "A" })).s === 422);
    ok("crear: sin nombre → 422", (await withKey("POST", "/admins", { email: e1, name: "" })).s === 422);
    const c1 = await withKey("POST", "/admins", { email: e1.toUpperCase(), name: "Admin A" });
    ok("crear: cuenta A sin contraseña", c1.s === 201 && c1.j.email === e1 && c1.j.has_password === false && !("password_hash" in c1.j), c1);
    ok("crear: correo repetido → 409", (await withKey("POST", "/admins", { email: e1, name: "A" })).s === 409);

    /* ---------- no entra sin contraseña ---------- */
    ok("login: cuenta sin contraseña → 401", (await call(WITH, "POST", "/login", { email: e1, password: "cualquier-cosa-123" })).s === 401);
    ok("login: contraseña vacía → 401", (await call(WITH, "POST", "/login", { email: e1, password: "" })).s === 401);

    /* ---------- código por correo ---------- */
    const unknown = await call(WITH, "POST", "/password/request", { email: "nadie@mibiyuyo.test" });
    ok("pedir código: correo desconocido responde igual y sin código", unknown.s === 200 && unknown.j.message && unknown.j.dev_code === undefined, unknown);
    const rq = await call(WITH, "POST", "/password/request", { email: e1 });
    ok("pedir código: mismo mensaje para un administrador", rq.s === 200 && rq.j.message === unknown.j.message, rq);
    const code = rq.j.dev_code;
    ok("sin correo configurado el código llega en dev_code (6 dígitos)", /^\d{6}$/.test(code || ""), rq.j);
    const h = (await pool.query(`SELECT reset_code_hash FROM admin_users WHERE email = $1`, [e1])).rows[0].reset_code_hash;
    ok("el código se guarda con hash", h && !h.includes(code) && h.startsWith("$2"));
    const again = await call(WITH, "POST", "/password/request", { email: e1 });
    ok("reenvío inmediato se ignora (el código anterior sigue válido)", again.s === 200 && again.j.dev_code === undefined);

    ok("reset: contraseña corta → 422", (await call(WITH, "POST", "/password/reset", { email: e1, code, password: "corta" })).s === 422);
    ok("reset: código incorrecto → 400", (await call(WITH, "POST", "/password/reset", { email: e1, code: "000000" === code ? "111111" : "000000", password: "contraseña-larga-1" })).s === 400);
    ok("reset: código de otra forma → 400", (await call(WITH, "POST", "/password/reset", { email: e1, code: "abc", password: "contraseña-larga-1" })).s === 400);
    ok("reset: correo desconocido → 400 igual", (await call(WITH, "POST", "/password/reset", { email: "nadie@mibiyuyo.test", code, password: "contraseña-larga-1" })).s === 400);
    const set = await call(WITH, "POST", "/password/reset", { email: e1, code, password: "contraseña-larga-1" });
    ok("reset: con el código correcto define la contraseña y entra", set.s === 200 && set.j.token && set.j.email === e1, set);
    ok("el código sirve una sola vez", (await call(WITH, "POST", "/password/reset", { email: e1, code, password: "otra-contraseña-77" })).s === 400);
    const A = withToken(set.j.token);
    ok("la sesión del reset abre el panel", (await A("GET", "/plans")).s === 200);
    const login = await call(WITH, "POST", "/login", { email: e1, password: "contraseña-larga-1" });
    ok("login con la contraseña nueva", login.s === 200);
    ok("login con otra contraseña → 401", (await call(WITH, "POST", "/login", { email: e1, password: "no-es-esta-123" })).s === 401);

    /* ---------- vencimiento e intentos del código ---------- */
    await allowResend(e1);
    const r2 = await call(WITH, "POST", "/password/request", { email: e1 });
    ok("recuperar: se pide otro código", /^\d{6}$/.test(r2.j.dev_code || ""));
    await pool.query(`UPDATE admin_users SET reset_expires_at = NOW() - INTERVAL '1 minute' WHERE email = $1`, [e1]);
    ok("un código vencido no sirve", (await call(WITH, "POST", "/password/reset", { email: e1, code: r2.j.dev_code, password: "contraseña-larga-1" })).s === 400);
    await allowResend(e1);
    const r3 = await call(WITH, "POST", "/password/request", { email: e1 });
    const wrong = r3.j.dev_code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) await call(WITH, "POST", "/password/reset", { email: e1, code: wrong, password: "contraseña-larga-1" });
    ok("tras 5 intentos fallidos el código queda bloqueado (aunque sea el correcto)", (await call(WITH, "POST", "/password/reset", { email: e1, code: r3.j.dev_code, password: "contraseña-larga-1" })).s === 400);

    /* ---------- recuperar cierra las otras sesiones ---------- */
    await pool.query(`UPDATE admin_users SET reset_sent_at = NOW() - INTERVAL '2 minutes' WHERE email = $1`, [e1]);
    await sleep(1100); // el cierre de sesiones compara en segundos
    const r4 = await call(WITH, "POST", "/password/request", { email: e1 });
        ok("recuperar: pedido dentro del límite", r4.s === 200 && /^\d{6}$/.test(r4.j.dev_code || ""), r4);
    const oldToken = login.j.token;
    ok("la sesión anterior sigue abierta antes del cambio", (await withToken(oldToken)("GET", "/plans")).s === 200);
    const rec = await call(WITH, "POST", "/password/reset", { email: e1, code: r4.j.dev_code, password: "recuperada-clave-55" });
    ok("recuperar: nueva contraseña", rec.s === 200);
    ok("la sesión anterior se cierra al cambiar la contraseña", (await withToken(oldToken)("GET", "/plans")).s === 401);
    ok("la sesión nueva funciona", (await withToken(rec.j.token)("GET", "/plans")).s === 200);
    ok("la contraseña vieja ya no entra", (await call(WITH, "POST", "/login", { email: e1, password: "contraseña-larga-1" })).s === 401);

    /* ---------- límite de pedidos de código ---------- */
    let blocked = false;
    for (let i = 0; i < 8; i++) {
      const r = await call(WITH, "POST", "/password/request", { email: `${TAG}-spam@mibiyuyo.test` });
      if (r.s === 429) blocked = true;
    }
    ok("pedir códigos sin parar se bloquea (429)", blocked);

    /* ---------- seguridad de la sesión ---------- */
    const S = withToken(rec.j.token);
    ok("clave de emergencia sigue funcionando", (await withKey("GET", "/me")).j.via === "clave");
    ok("sin credenciales → 401", (await call(WITH, "GET", "/plans")).s === 401);
    ok("token inventado → 401", (await withToken("abc.def.ghi")("GET", "/plans")).s === 401);
    const userJwt = require("jsonwebtoken").sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: "1h" });
    ok("el token de un usuario de la app no sirve", (await withToken(userJwt)("GET", "/plans")).s === 401);
    ok("/me dice quién es", (await S("GET", "/me")).j.email === e1);

    /* ---------- gestión de cuentas desde una sesión ---------- */
    const c2 = await S("POST", "/admins", { email: e2, name: "Admin B" });
    ok("una cuenta crea a otra (sin contraseña)", c2.s === 201 && c2.j.created_by === e1 && c2.j.has_password === false, c2);
    ok("lista con has_password", (await S("GET", "/admins")).j.filter((x) => x.email.startsWith(TAG)).length === 2);
    ok("no puede desactivarse a sí misma", (await S("PUT", `/admins/${c1.j.id}`, { active: false })).s === 409);
    ok("no puede eliminarse a sí misma", (await S("DELETE", `/admins/${c1.j.id}`)).s === 409);
    ok("cambia el nombre de otra", (await S("PUT", `/admins/${c2.j.id}`, { name: "Nuevo" })).j.name === "Nuevo");
    ok("ya no se fijan contraseñas ajenas → 422", (await S("PUT", `/admins/${c2.j.id}`, { password: "fijada-por-otro-1" })).s === 422);
    ok("sin cambios → 422", (await S("PUT", `/admins/${c2.j.id}`, {})).s === 422);
    const inv = await S("POST", `/admins/${c2.j.id}/invite`);
    ok("enviar código de acceso a otra cuenta", inv.s === 200 && /^\d{6}$/.test(inv.j.dev_code || ""), inv);
    ok("invitar a una cuenta inexistente → 404", (await S("POST", "/admins/999999/invite")).s === 404);
    const setB = await call(WITH, "POST", "/password/reset", { email: e2, code: inv.j.dev_code, password: "clave-de-b-12345" });
    ok("B crea su contraseña con ese código", setB.s === 200);
    const B = withToken(setB.j.token);
    ok("B entra", (await B("GET", "/plans")).s === 200);
    ok("A desactiva a B", (await S("PUT", `/admins/${c2.j.id}`, { active: false })).s === 200);
    ok("la sesión de B se corta al instante", (await B("GET", "/plans")).s === 401);
    ok("B desactivado no puede iniciar sesión", (await call(WITH, "POST", "/login", { email: e2, password: "clave-de-b-12345" })).s === 401);
    ok("invitar a una cuenta desactivada → 409", (await S("POST", `/admins/${c2.j.id}/invite`)).s === 409);
    ok("B desactivado no recibe código", (await call(WITH, "POST", "/password/request", { email: e2 })).j.dev_code === undefined);

    /* ---------- cambio de contraseña propio ---------- */
    ok("mi contraseña: actual incorrecta → 401", (await S("POST", "/me/password", { current: "nope-nope-nope", password: "nueva-contraseña-33" })).s === 401);
    ok("mi contraseña: nueva corta → 422", (await S("POST", "/me/password", { current: "recuperada-clave-55", password: "corta" })).s === 422);
    await sleep(1100);
    const chg = await S("POST", "/me/password", { current: "recuperada-clave-55", password: "nueva-contraseña-33" });
    ok("mi contraseña: se cambia y devuelve una sesión nueva", chg.s === 200 && chg.j.token, chg);
    ok("…la sesión anterior se cierra", (await S("GET", "/plans")).s === 401);
    ok("…la nueva sigue", (await withToken(chg.j.token)("GET", "/plans")).s === 200);
    ok("con la clave de emergencia no hay contraseña que cambiar", (await withKey("POST", "/me/password", { current: "x", password: "nueva-contraseña-33" })).s === 422);
    ok("A elimina a B", (await withToken(chg.j.token)("DELETE", `/admins/${c2.j.id}`)).s === 200);

    /* ---------- registro de actividad ---------- */
    const log = (await withToken(chg.j.token)("GET", "/activity?per=100")).j;
    const acts = log.rows.map((r) => r.action);
    ok("el registro guarda pedidos y cambios de contraseña", acts.includes("PASSWORD_CODE_REQUEST") && acts.includes("PASSWORD_RESET") && acts.includes("LOGIN"));
    ok("el registro marca los fallos", log.rows.some((r) => r.action === "PASSWORD_RESET" && r.ok === false));
    const dump = JSON.stringify(log.rows);
    ok("el registro nunca guarda contraseñas ni códigos", !dump.includes("contraseña-larga") && !dump.includes("recuperada-clave") && !dump.includes(code));
    ok("las consultas (GET) no se registran", !log.rows.some((r) => r.action.startsWith("GET ")));
    ok("registro paginado", log.page === 1 && log.pages >= 1 && log.total >= log.rows.length);

    /* ---------- sin ADMIN_KEY: el panel existe mientras haya cuentas activas ---------- */
    ok("sin clave de emergencia pero con cuentas, la página existe", (await fetch(WITHOUT + "/admin/")).status === 200);
    const e3 = `${TAG}-c@mibiyuyo.test`;
    // Alta directa en la base (sin contraseña), como la haría el dueño a mano
    await pool.query(`INSERT INTO admin_users (email, name) VALUES ($1, 'Alta manual')`, [e3]);
    const r5 = await call(WITHOUT, "POST", "/password/request", { email: e3 });
    ok("alta manual en la base: pide su código", r5.s === 200 && /^\d{6}$/.test(r5.j.dev_code || ""), r5);
    const man = await call(WITHOUT, "POST", "/password/reset", { email: e3, code: r5.j.dev_code, password: "alta-manual-12345" });
    ok("alta manual: crea su contraseña y entra", man.s === 200);
    ok("sin ADMIN_KEY: la clave no entra", (await call(WITHOUT, "GET", "/plans", null, { "x-admin-key": KEY })).s === 401);
    const N = withToken(man.j.token, WITHOUT);
    const idC = (await pool.query(`SELECT id FROM admin_users WHERE email = $1`, [e3])).rows[0].id;
    ok("sin ADMIN_KEY: no puede desactivarse ni eliminarse a sí misma", (await N("PUT", `/admins/${idC}`, { active: false })).s === 409 && (await N("DELETE", `/admins/${idC}`)).s === 409);
  } finally {
    servers.forEach((s) => s.kill());
    await cleanup();
    await pool.end();
  }
  console.log(`\n${pass} correctas, ${fail} con fallo`);
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => {
  console.error(e);
  servers.forEach((s) => s.kill());
  await cleanup().catch(() => {});
  process.exit(1);
});
