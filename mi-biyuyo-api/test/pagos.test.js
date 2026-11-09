// Pruebas de la Fase 3 (pagos, códigos de canje, panel de administración) contra la base LOCAL.
// Levanta su propia API con la función encendida y ADMIN_KEY de prueba (puerto 3101) y otra sin
// ADMIN_KEY (3102). Crea usuarios qa-pagos-*@mibiyuyo.test y datos «QA-test» y los borra al final.
//   npm run test:pagos
require("../src/config/loadEnv");
const { spawn } = require("child_process");
const path = require("path");
const pool = require("../src/config/database");
const { runExpiryNotices } = require("../src/utils/billing");

if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)) {
  console.log("ABORTO: la base no es local (" + process.env.DB_HOST + ")");
  process.exit(1);
}

const ON = "http://localhost:3101";
const NOADMIN = "http://localhost:3102";
const KEY = "clave-de-prueba-0123456789";
const EMAIL = (n) => `qa-pagos-${Date.now()}-${n}@mibiyuyo.test`;
const DAY = 86400000;
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
  const r = await fetch(base + p, {
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
const adm = (m, p, b, key = KEY) => call(ON, m, "/api/admin" + p, b, { "x-admin-key": key });
const api = (u, m, p, b) => call(ON, m, p, b, { Authorization: "Bearer " + u.token });
const sql = (q, params) => pool.query(q, params);

const servers = [];
function start(port, env) {
  servers.push(
    spawn(process.execPath, [path.join(__dirname, "../src/index.js")], {
      env: { ...process.env, PORT: String(port), ...env },
      stdio: "ignore",
    }),
  );
}
async function waitFor(base) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/health")).ok) return;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("La API no arrancó: " + base);
}

async function newUser(label) {
  const email = EMAIL(label);
  const reg = await call(ON, "POST", "/api/auth/register", { name: "QA " + label, email, password: "Prueba1234!" });
  if (reg.s !== 201 || !reg.j.dev_code) throw new Error("No se pudo registrar: " + JSON.stringify(reg));
  const v = await call(ON, "POST", "/api/auth/verify-email", { email, code: reg.j.dev_code });
  const { rows } = await sql("SELECT id FROM users WHERE email = $1", [email]);
  return { token: v.j.token, id: rows[0].id, email };
}
const premiumUntil = async (u) =>
  (await sql("SELECT premium_until FROM users WHERE id = $1", [u.id])).rows[0].premium_until;
const near = (date, ms, tolMs = 2 * DAY) => date && Math.abs(new Date(date) - (Date.now() + ms)) < tolMs;
const pay = (u, over = {}) =>
  api(u, "POST", "/api/subscription/payments", {
    plan_code: "monthly",
    method: "pago_movil",
    reference: "REF" + Math.floor(Math.random() * 1e9),
    paid_amount: 250,
    ...over,
  });

async function cleanup() {
  const { rows } = await sql(`SELECT id FROM users WHERE email LIKE 'qa-pagos-%@mibiyuyo.test'`);
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await sql(`DELETE FROM subscription_payments WHERE user_id = ANY($1)`, [ids]);
    await sql(`UPDATE redeem_codes SET used_by = NULL WHERE used_by = ANY($1)`, [ids]);
    await sql(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
  }
  await sql(`DELETE FROM redeem_codes WHERE created_at > NOW() - INTERVAL '1 day' AND (plan_code = 'monthly' OR days IN (10, 77))`);
  await sql(`DELETE FROM payment_receivers WHERE label LIKE 'QA-test%'`);
}

async function main() {
  await cleanup();
  const settings = (await sql(`SELECT key, value FROM app_settings`)).rows;
  const plans0 = (await sql(`SELECT code, price_usd, days, active, name FROM subscription_plans`)).rows;
  const setSetting = (k, v) =>
    sql(`INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [k, String(v)]);
  await setSetting("trial_days", 14);
  await setSetting("bcv_rate_override", 100); // tasa fija: 2,50 USD = 250 VES
  await sql(`INSERT INTO payment_receivers (method, label, details, sort_order) VALUES
    ('pago_movil', 'QA-test Pago móvil', '[{"label":"Teléfono","value":"0000"}]', 901),
    ('zinli', 'QA-test Zinli', '[{"label":"Correo","value":"qa@example.com"}]', 902)`);

  start(3101, { SUBSCRIPTIONS_ENABLED: "true", ADMIN_KEY: KEY });
  start(3102, { SUBSCRIPTIONS_ENABLED: "true", ADMIN_KEY: "" });
  await waitFor(ON);
  await waitFor(NOADMIN);

  /* ---------- sin ADMIN_KEY no hay panel ---------- */
  ok("sin ADMIN_KEY: /api/admin no existe (404)", (await call(NOADMIN, "GET", "/api/admin/plans", null, { "x-admin-key": KEY })).s === 404);
  ok("sin ADMIN_KEY: /admin no existe (404)", (await fetch(NOADMIN + "/admin/")).status === 404);
  ok("con ADMIN_KEY: /admin sirve la página", (await fetch(ON + "/admin/")).status === 200);
  ok("con ADMIN_KEY: /admin/admin.js", (await fetch(ON + "/admin/admin.js")).status === 200);

  /* ---------- acceso al panel ---------- */
  ok("panel: sin clave → 401", (await call(ON, "GET", "/api/admin/plans")).s === 401);
  ok("panel: clave incorrecta → 401", (await adm("GET", "/plans", null, "otra-clave")).s === 401);
  ok("panel: clave correcta → 200", (await adm("GET", "/plans")).s === 200);

  const u1 = await newUser("a");
  const u2 = await newUser("b");
  ok("un usuario con su token no entra al panel", (await call(ON, "GET", "/api/admin/payments", null, { Authorization: "Bearer " + u1.token })).s === 401);
  ok("pagos: exige sesión", (await call(ON, "GET", "/api/subscription/payments")).s === 401);
  ok("canje: exige sesión", (await call(ON, "POST", "/api/subscription/redeem", { code: "AAAA" })).s === 401);

  /* ---------- cómo pagar ---------- */
  const rc = (await api(u1, "GET", "/api/subscription/receivers")).j;
  ok("receivers: tasa BCV fija 100", rc.bcv_rate === 100, rc.bcv_rate);
  ok("receivers: mensual 2,50 USD = 250 VES", rc.plans.find((p) => p.code === "monthly").amount_ves === 250, rc.plans);
  ok("receivers: anual 20 USD = 2000 VES", rc.plans.find((p) => p.code === "annual").amount_ves === 2000);
  ok("receivers: pago móvil se cobra en VES, zinli en USD",
    rc.receivers.find((r) => r.method === "pago_movil").currency === "VES" && rc.receivers.find((r) => r.method === "zinli").currency === "USD");

  /* ---------- solicitar un pago ---------- */
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const p1 = await pay(u1, { reference: "REF-UNO-1234", proof_data: png, proof_name: "captura.png" });
  ok("pago: se crea pendiente", p1.s === 201 && p1.j.status === "pending" && p1.j.expected_amount === 250 && p1.j.expected_currency === "VES", p1);
  ok("pago: misma referencia → 409", (await pay(u2, { reference: "ref-uno-1234" })).s === 409);
  ok("pago: monto menor a la mitad → 422", (await pay(u1, { paid_amount: 100 })).s === 422);
  ok("pago: plan inexistente → 422", (await pay(u1, { plan_code: "gratis" })).s === 422);
  ok("pago: método inexistente → 422", (await pay(u1, { method: "bitcoin" })).s === 422);
  ok("pago: referencia muy corta → 422", (await pay(u1, { reference: "12" })).s === 422);
  ok("pago: sin monto → 422", (await pay(u1, { paid_amount: -5 })).s === 422);
  ok("pago: comprobante que no es imagen/PDF → 422", (await pay(u1, { proof_data: "data:text/html;base64,PGI+" })).s === 422);
  ok("pago: comprobante gigante → 422", (await pay(u1, { proof_data: "data:image/png;base64," + "A".repeat(3_100_000) })).s === 422);
  const z = await pay(u1, { plan_code: "annual", method: "zinli", paid_amount: 20 });
  ok("pago en USD (zinli): esperado 20 USD", z.s === 201 && z.j.expected_amount === 20 && z.j.expected_currency === "USD", z);
  const own = (await api(u1, "GET", "/api/subscription/payments")).j;
  ok("el usuario ve sus pagos, sin comprobante", own.length === 2 && own.every((p) => !("proof_data" in p)), own.length);
  ok("otro usuario no ve pagos ajenos", (await api(u2, "GET", "/api/subscription/payments")).j.length === 0);

  // tope de pagos pendientes
  const u3 = await newUser("c");
  for (let i = 0; i < 3; i++) await pay(u3);
  ok("máximo 3 pagos en revisión → 429", (await pay(u3)).s === 429);

  /* ---------- panel: revisar ---------- */
  const pend = (await adm("GET", "/payments?status=pending")).j;
  const mine = pend.find((p) => p.reference === "REF-UNO-1234");
  ok("panel: lista el pago pendiente con el correo", mine && mine.email === u1.email && mine.has_proof === true, mine);
  ok("panel: comprobante", (await adm("GET", `/payments/${mine.id}/proof`)).j.data === png);
  const noProof = pend.find((p) => p.method === "zinli" && p.user_id === u1.id);
  ok("panel: sin comprobante → 404", (await adm("GET", `/payments/${noProof.id}/proof`)).s === 404);
  ok("panel: id no numérico → 404", (await adm("GET", "/payments/abc/proof")).s === 404);

  /* ---------- aprobar ---------- */
  ok("antes de pagar: el usuario no tiene Premium", (await premiumUntil(u1)) === null || new Date(await premiumUntil(u1)) < new Date());
  const ap = await adm("POST", `/payments/${mine.id}/approve`);
  ok("aprobar → 200", ap.s === 200 && ap.j.status === "approved", ap);
  ok("aprobar suma 30 días de Premium", near(await premiumUntil(u1), 30 * DAY), await premiumUntil(u1));
  ok("el plan del usuario es premium", (await api(u1, "GET", "/api/subscription")).j.plan === "premium");
  ok("aprobar dos veces → 409", (await adm("POST", `/payments/${mine.id}/approve`)).s === 409);
  ok("no se suma dos veces", near(await premiumUntil(u1), 30 * DAY));
  const before = new Date(await premiumUntil(u1)).getTime();
  ok("pago a un usuario que ya tiene Premium: SUMA", (await adm("POST", `/payments/${noProof.id}/approve`)).s === 200
    && Math.abs(new Date(await premiumUntil(u1)).getTime() - (before + 365 * DAY)) < 1000, [before, await premiumUntil(u1)]);

  /* ---------- rechazar ---------- */
  const r1 = await pay(u2, { reference: "REF-RECHAZO-1" });
  ok("rechazar sin motivo → 422", (await adm("POST", `/payments/${r1.j.id}/reject`, { reason: "" })).s === 422);
  ok("rechazar con motivo → 200", (await adm("POST", `/payments/${r1.j.id}/reject`, { reason: "No llegó el dinero" })).s === 200);
  const seen = (await api(u2, "GET", "/api/subscription/payments")).j.find((p) => p.id === r1.j.id);
  ok("el usuario ve el rechazo y su motivo", seen.status === "rejected" && seen.reject_reason === "No llegó el dinero", seen);
  ok("un pago rechazado no se puede aprobar → 409", (await adm("POST", `/payments/${r1.j.id}/approve`)).s === 409);
  ok("tras un rechazo la referencia se puede volver a enviar", (await pay(u2, { reference: "REF-RECHAZO-1" })).s === 201);
  ok("rechazar un pago ya aprobado → 409", (await adm("POST", `/payments/${mine.id}/reject`, { reason: "x y z" })).s === 409);

  /* ---------- aprobación simultánea ---------- */
  const u4 = await newUser("d");
  const race = await pay(u4);
  const both = await Promise.all([adm("POST", `/payments/${race.j.id}/approve`), adm("POST", `/payments/${race.j.id}/approve`)]);
  ok("dos aprobaciones a la vez: una gana y otra 409", both.map((r) => r.s).sort().join() === "200,409", both.map((r) => r.s));
  ok("…y los días se suman una sola vez", near(await premiumUntil(u4), 30 * DAY, DAY));

  /* ---------- códigos de canje ---------- */
  ok("códigos: sin plan ni días → 422", (await adm("POST", "/codes", { count: 1 })).s === 422);
  ok("códigos: cantidad inválida → 422", (await adm("POST", "/codes", { plan_code: "monthly", count: 99 })).s === 422);
  const gen = await adm("POST", "/codes", { plan_code: "monthly", count: 2 });
  ok("códigos: se generan 2 con formato XXXX-XXXX-XXXX", gen.s === 201 && gen.j.codes.length === 2 && gen.j.codes.every((c) => /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c)), gen.j);
  const [c1, c2] = gen.j.codes;
  const u5 = await newUser("e");
  const rd = await api(u5, "POST", "/api/subscription/redeem", { code: " " + c1.toLowerCase().replace(/-/g, " ") + " " });
  ok("canje: acepta minúsculas y espacios", rd.s === 200 && rd.j.days === 30 && rd.j.plan === "premium", rd);
  ok("canje: suma 30 días", near(await premiumUntil(u5), 30 * DAY, DAY));
  ok("canje: un código usado no sirve de nuevo (otro usuario)", (await api(u2, "POST", "/api/subscription/redeem", { code: c1 })).s === 400);
  ok("canje: ni para el mismo usuario", (await api(u5, "POST", "/api/subscription/redeem", { code: c1 })).s === 400);
  ok("canje: código inexistente → 400", (await api(u2, "POST", "/api/subscription/redeem", { code: "ZZZZ-ZZZZ-ZZZZ" })).s === 400);
  const days10 = (await adm("POST", "/codes", { days: 10 })).j.codes[0];
  const b5 = new Date(await premiumUntil(u5)).getTime();
  ok("canje por días sueltos: suma 10 al Premium vigente", (await api(u5, "POST", "/api/subscription/redeem", { code: days10 })).s === 200
    && Math.abs(new Date(await premiumUntil(u5)).getTime() - (b5 + 10 * DAY)) < 1000);
  // vencido
  const exp = (await adm("POST", "/codes", { days: 77, expires_in_days: 1 })).j.codes[0];
  await sql(`UPDATE redeem_codes SET expires_at = NOW() - INTERVAL '1 hour' WHERE code = $1`, [exp.replace(/-/g, "")]);
  ok("canje: código vencido → 400", (await api(u2, "POST", "/api/subscription/redeem", { code: exp })).s === 400);
  // carrera: el mismo código lo canjean dos usuarios a la vez
  const u6 = await newUser("f");
  const u7 = await newUser("g");
  const rc2 = await Promise.all([api(u6, "POST", "/api/subscription/redeem", { code: c2 }), api(u7, "POST", "/api/subscription/redeem", { code: c2 })]);
  ok("código canjeado a la vez por dos usuarios: solo uno gana", rc2.map((r) => r.s).sort().join() === "200,400", rc2.map((r) => r.s));
  // intentos fallidos
  const u8 = await newUser("h");
  const tries = [];
  for (let i = 0; i < 6; i++) tries.push((await api(u8, "POST", "/api/subscription/redeem", { code: "BAD" + i + "-CODE-XXXX" })).s);
  ok("canje: 5 códigos malos y el 6.º se bloquea (429)", tries.slice(0, 5).every((s) => s === 400) && tries[5] === 429, tries);
  const list = (await adm("GET", "/codes")).j;
  ok("panel: lista códigos con quién los usó", list.find((c) => c.code === c1).used_by_email === u5.email);
  const free = (await adm("POST", "/codes", { days: 10 })).j.codes[0];
  const freeRow = (await adm("GET", "/codes")).j.find((c) => c.code === free);
  ok("panel: elimina un código sin usar", (await adm("DELETE", `/codes/${freeRow.id}`)).s === 200);
  ok("panel: no elimina un código usado", (await adm("DELETE", `/codes/${list.find((c) => c.code === c1).id}`)).s === 409);

  /* ---------- usuarios, regalos y prueba ---------- */
  ok("usuarios: búsqueda corta → 422", (await adm("GET", "/users?q=ab")).s === 422);
  const f = (await adm("GET", `/users?q=${encodeURIComponent(u6.email)}`)).j;
  ok("usuarios: encuentra por correo con su plan", f.length === 1 && f[0].plan === "premium", f);
  const u9 = await newUser("i");
  ok("regalar: correo inexistente → 404", (await adm("POST", "/gift", { email: "nadie@x.test", days: 5 })).s === 404);
  ok("regalar Premium +10 días", (await adm("POST", "/gift", { email: u9.email, target: "premium", days: 10 })).s === 200 && near(await premiumUntil(u9), 10 * DAY, DAY));
  ok("regalar Premium: días inválidos → 422", (await adm("POST", "/gift", { email: u9.email, target: "premium", days: -5 })).s === 422);
  const t0 = (await sql(`SELECT trial_ends_at FROM users WHERE id = $1`, [u9.id])).rows[0].trial_ends_at.getTime();
  await adm("POST", "/gift", { email: u9.email, target: "trial", days: 5 });
  const t1 = (await sql(`SELECT trial_ends_at FROM users WHERE id = $1`, [u9.id])).rows[0].trial_ends_at.getTime();
  ok("prueba +5 días", Math.abs(t1 - (t0 + 5 * DAY)) < 1000);
  await adm("POST", "/gift", { email: u9.email, target: "trial", days: -100 });
  const t2 = (await sql(`SELECT trial_ends_at FROM users WHERE id = $1`, [u9.id])).rows[0].trial_ends_at.getTime();
  ok("restar más días que los que quedan: nunca antes de hoy", t2 >= Date.now() - 5000 && t2 <= Date.now() + 5000, t2 - Date.now());
  ok("ajuste masivo sin confirmar → 422", (await adm("POST", "/trial/bulk", { days: 2 })).s === 422);
  const uT = await newUser("j"); // en prueba (≈14 días) sin Premium
  const tBefore = (await sql(`SELECT trial_ends_at FROM users WHERE id = $1`, [uT.id])).rows[0].trial_ends_at.getTime();
  const pBefore = new Date(await premiumUntil(u1)).getTime();
  const bulk = await adm("POST", "/trial/bulk", { days: 2, confirm: true });
  const tAfter = (await sql(`SELECT trial_ends_at FROM users WHERE id = $1`, [uT.id])).rows[0].trial_ends_at.getTime();
  ok("ajuste masivo: suma a quien está en prueba", bulk.s === 200 && bulk.j.updated >= 1 && Math.abs(tAfter - (tBefore + 2 * DAY)) < 1000, bulk);
  ok("ajuste masivo: no toca a quien ya tiene Premium", new Date(await premiumUntil(u1)).getTime() === pBefore);
  await adm("POST", "/trial/bulk", { days: -2, confirm: true }); // deja las fechas como estaban

  /* ---------- configuración y planes ---------- */
  ok("ajustes: días negativos → 422", (await adm("PUT", "/settings", { trial_days: -1 })).s === 422);
  ok("ajustes: días con texto → 422", (await adm("PUT", "/settings", { trial_days: "abc" })).s === 422);
  ok("ajustes: más de 365 → 422", (await adm("PUT", "/settings", { trial_days: 400 })).s === 422);
  ok("ajustes: clave desconocida → 422", (await adm("PUT", "/settings", { admin_key: "x" })).s === 422);
  ok("ajustes: tasa inválida → 422", (await adm("PUT", "/settings", { bcv_rate_override: "-3" })).s === 422);
  ok("ajustes: días de prueba = 5", (await adm("PUT", "/settings", { trial_days: 5 })).s === 200);
  ok("…un usuario nuevo recibe 5 días", (await newUser("k")).id && (await sql(`SELECT trial_days_granted FROM users WHERE email LIKE 'qa-pagos-%-k@mibiyuyo.test'`)).rows[0].trial_days_granted === 5);
  await adm("PUT", "/settings", { trial_days: 14 });
  ok("ajustes: la tasa se puede quitar", (await adm("PUT", "/settings", { bcv_rate_override: "" })).s === 200
    && (await sql(`SELECT 1 FROM app_settings WHERE key = 'bcv_rate_override'`)).rows.length === 0);
  await setSetting("bcv_rate_override", 100);
  ok("planes: precio inválido → 422", (await adm("PUT", "/plans/monthly", { price_usd: 0, days: 30 })).s === 422);
  ok("planes: días inválidos → 422", (await adm("PUT", "/plans/monthly", { price_usd: 3, days: 0 })).s === 422);
  ok("planes: plan inexistente → 404", (await adm("PUT", "/plans/zzz", { price_usd: 3, days: 30 })).s === 404);
  ok("planes: se actualiza el precio", (await adm("PUT", "/plans/monthly", { price_usd: 3, days: 30 })).s === 200);
  ok("…y lo ve el usuario", (await api(u1, "GET", "/api/subscription")).j.plans.find((p) => p.code === "monthly").price_usd === 3);
  await adm("PUT", "/plans/monthly", { price_usd: 2.5, days: 30 });

  /* ---------- datos de cobro ---------- */
  ok("cobro: método inválido → 422", (await adm("POST", "/receivers", { method: "Pago Móvil", label: "x", details: [{ label: "a", value: "b" }] })).s === 422);
  ok("cobro: sin datos → 422", (await adm("POST", "/receivers", { method: "binance_pay", label: "QA-test Binance", details: [] })).s === 422);
  const nr = await adm("POST", "/receivers", { method: "binance_pay", label: "QA-test Binance", details: [{ label: "Pay ID", value: "123" }] });
  ok("cobro: se crea", nr.s === 201);
  ok("cobro: lo ve el usuario", (await api(u1, "GET", "/api/subscription/receivers")).j.receivers.some((r) => r.id === nr.j.id));
  ok("cobro: se desactiva y deja de verse", (await adm("PUT", `/receivers/${nr.j.id}`, { method: "binance_pay", label: "QA-test Binance", details: [{ label: "Pay ID", value: "123" }], active: false })).s === 200
    && !(await api(u1, "GET", "/api/subscription/receivers")).j.receivers.some((r) => r.id === nr.j.id));
  ok("cobro: se elimina", (await adm("DELETE", `/receivers/${nr.j.id}`)).s === 200);

  /* ---------- avisos de vencimiento ---------- */
  const uN = await newUser("l");
  await sql(`UPDATE users SET premium_until = NOW() + INTERVAL '2 days' WHERE id = $1`, [uN.id]);
  const uLate = await newUser("m");
  await sql(`UPDATE users SET premium_until = NOW() + INTERVAL '10 days' WHERE id = $1`, [uLate.id]);
  const uTr = await newUser("n");
  await sql(`UPDATE users SET trial_ends_at = NOW() + INTERVAL '2 days' WHERE id = $1`, [uTr.id]);
  const sentTo = [];
  const fake = async (m) => sentTo.push(m.to);
  ok("avisos: sin correo configurado no hace nada", (await runExpiryNotices({ sendFn: fake, configured: false })) === 0 && sentTo.length === 0);
  await runExpiryNotices({ sendFn: fake, configured: true });
  ok("avisos: Premium que vence en 2 días", sentTo.includes(uN.email));
  ok("avisos: prueba que termina en 2 días", sentTo.includes(uTr.email));
  ok("avisos: no avisa a quien le falta mucho", !sentTo.includes(uLate.email));
  const n1 = sentTo.length;
  await runExpiryNotices({ sendFn: fake, configured: true });
  ok("avisos: no se repiten", sentTo.length === n1);

  /* ---------- Premium vence y vuelve (entidades, deudas y categorías propias) ---------- */
  const uV = await newUser("v");
  await sql(`UPDATE users SET premium_until = NOW() + INTERVAL '30 days' WHERE id = $1`, [uV.id]);
  const entV = async (name) => api(uV, "POST", "/api/entities", { name, kind: "banco", currency: "usd", initial_amount: 50 });
  const eA = await entV("QA V1");
  const eB = await entV("QA V2");
  const LV = (await api(uV, "GET", "/api/ledger")).j;
  const catV = (t) => LV.categories.find((c) => c.type === t && !c.own);
  const ownV = await api(uV, "POST", "/api/categories", { type: "expense", name: "QA propia V", icon: "more" });
  const debtV = await api(uV, "POST", "/api/transactions", { category_id: catV("debt").id, amount: 40, currency: "USD", cash: false });
  ok("premium: crea 2 entidades, categoría propia y una deuda", eA.s === 201 && eB.s === 201 && ownV.s === 201 && debtV.s === 201);
  await sql(`UPDATE users SET premium_until = NOW() - INTERVAL '1 day', trial_ends_at = NOW() - INTERVAL '10 days' WHERE id = $1`, [uV.id]);
  const sv = (await api(uV, "GET", "/api/subscription")).j;
  ok("vence: pasa a gratis y la 2.ª entidad queda en solo lectura", sv.plan === "free" && sv.locked_entity_ids.join() === String(eB.j.id), sv);
  const Lv = (await api(uV, "GET", "/api/ledger")).j;
  ok("vence: no se borra nada (2 entidades, deuda y categoría propia)", Lv.entities.length === 2 && Lv.transactions.some((t) => t.id === debtV.j.id) && Lv.categories.some((c) => c.id === ownV.j.id));
  ok("vence: no puede abonar la deuda", (await api(uV, "POST", `/api/transactions/${debtV.j.id}/payments`, { amount: 1, currency: "USD", entity_id: eA.j.id })).s === 402);
  ok("vence: no puede usar su categoría propia", (await api(uV, "POST", "/api/transactions", { category_id: ownV.j.id, amount: 1, currency: "USD", entity_id: eA.j.id })).s === 402);
  ok("vence: no registra en la entidad bloqueada", (await api(uV, "POST", "/api/transactions", { category_id: catV("expense").id, amount: 1, currency: "USD", entity_id: eB.j.id })).s === 402);
  // vuelve con un código de canje
  const back = (await adm("POST", "/codes", { plan_code: "monthly" })).j.codes[0];
  ok("canje: Premium vuelve", (await api(uV, "POST", "/api/subscription/redeem", { code: back })).s === 200);
  const sv2 = (await api(uV, "GET", "/api/subscription")).j;
  ok("vuelve: plan premium y sin entidades bloqueadas", sv2.plan === "premium" && sv2.locked_entity_ids.length === 0, sv2);
  ok("vuelve: abona la deuda", (await api(uV, "POST", `/api/transactions/${debtV.j.id}/payments`, { amount: 5, currency: "USD", entity_id: eA.j.id })).s === 201);
  ok("vuelve: usa su categoría propia", (await api(uV, "POST", "/api/transactions", { category_id: ownV.j.id, amount: 1, currency: "USD", entity_id: eB.j.id })).s === 201);
  // vence otra vez y vuelve por un pago aprobado
  await sql(`UPDATE users SET premium_until = NOW() - INTERVAL '1 hour' WHERE id = $1`, [uV.id]);
  ok("vence de nuevo → gratis", (await api(uV, "GET", "/api/subscription")).j.plan === "free");
  const pv = await pay(uV);
  await adm("POST", `/payments/${pv.j.id}/approve`);
  ok("vuelve con un pago aprobado", (await api(uV, "GET", "/api/subscription")).j.plan === "premium");

  /* ---------- fuerza bruta de la clave (al final: bloquea la IP) ---------- */
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await adm("GET", "/plans", null, "mala-" + i)).s);
  ok("clave de administración: 10 fallos bloquean (429)", codes.slice(0, 10).every((s) => s === 401) && codes[10] === 429, codes);
  ok("…aun con la clave correcta mientras dure el bloqueo", (await adm("GET", "/plans")).s === 429);

  // Deja la configuración como estaba
  await sql(`DELETE FROM app_settings`);
  for (const r of settings) await sql(`INSERT INTO app_settings (key, value) VALUES ($1,$2)`, [r.key, r.value]);
  for (const p of plans0)
    await sql(`UPDATE subscription_plans SET price_usd=$2, days=$3, active=$4, name=$5 WHERE code=$1`, [p.code, p.price_usd, p.days, p.active, p.name]);
}

(async () => {
  try {
    await main();
  } catch (e) {
    fail++;
    console.log("ERROR en la prueba:", e.stack || e.message);
  } finally {
    try {
      await cleanup();
    } catch (e) {
      console.log("No se pudo limpiar:", e.message);
    }
    servers.forEach((s) => s.kill());
    await pool.end();
    console.log(`\n${pass} correctas, ${fail} con fallo`);
    process.exit(fail ? 1 : 0);
  }
})();
