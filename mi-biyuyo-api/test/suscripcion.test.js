// Pruebas de la suscripción (Fase 1) contra la base LOCAL.
// Levanta su propia API con SUBSCRIPTIONS_ENABLED=true (puerto 3101) y otra con la función
// apagada (3102), crea usuarios de prueba (qa-subs-*@mibiyuyo.test), mueve sus fechas en la base y
// comprueba cada regla. Se niega a correr si la base no es local.
//   npm run test:suscripcion
require("../src/config/loadEnv");
const { spawn } = require("child_process");
const path = require("path");
const pool = require("../src/config/database");

if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)) {
  console.log("ABORTO: la base no es local (" + process.env.DB_HOST + ")");
  process.exit(1);
}

const ON = "http://localhost:3101";
const OFF = "http://localhost:3102";
const EMAIL = (n) => `qa-subs-${Date.now()}-${n}@mibiyuyo.test`;
let pass = 0;
let fail = 0;
const ok = (name, cond, extra) => {
  if (cond) pass++;
  else {
    fail++;
    console.log("  FALLA", name, extra !== undefined ? JSON.stringify(extra) : "");
  }
};

const call = async (base, method, p, body, tok) => {
  const r = await fetch(base + p, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(tok ? { Authorization: "Bearer " + tok } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch (e) {}
  return { s: r.status, j };
};

const servers = [];
function start(port, enabled) {
  const child = spawn(process.execPath, [path.join(__dirname, "../src/index.js")], {
    env: { ...process.env, PORT: String(port), SUBSCRIPTIONS_ENABLED: String(enabled) },
    stdio: "ignore",
  });
  servers.push(child);
}
async function waitFor(base) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base + "/health");
      if (r.ok) return;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("La API no arrancó: " + base);
}

// Registra y verifica un usuario en el servidor `base`; devuelve { token, id, email, sub }
async function newUser(base, label) {
  const email = EMAIL(label);
  const reg = await call(base, "POST", "/api/auth/register", {
    name: "QA " + label,
    email,
    password: "Prueba1234!",
  });
  if (reg.s !== 201 || !reg.j.dev_code)
    throw new Error("No se pudo registrar (¿correo configurado?): " + JSON.stringify(reg));
  const v = await call(base, "POST", "/api/auth/verify-email", { email, code: reg.j.dev_code });
  const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  return { token: v.j.token, id: rows[0].id, email, sub: v.j.subscription, base };
}
const sql = (q, params) => pool.query(q, params);
const sub = async (u) => (await call(u.base, "GET", "/api/subscription", null, u.token)).j;
const api = (u, m, p, b) => call(u.base, m, p, b, u.token);
const isPlan402 = (r, feature) =>
  r.s === 402 && r.j.code === "PLAN_REQUIRED" && (!feature || r.j.feature === feature);

async function cleanup() {
  const { rows } = await sql(`SELECT id FROM users WHERE email LIKE 'qa-subs-%@mibiyuyo.test'`);
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await sql(`DELETE FROM balance_adjustments WHERE user_id = ANY($1)`, [ids]);
    await sql(`DELETE FROM transfers WHERE user_id = ANY($1)`, [ids]);
    await sql(`DELETE FROM transaction_payments WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ANY($1))`, [ids]);
    await sql(`DELETE FROM transactions WHERE user_id = ANY($1)`, [ids]);
    await sql(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
  }
}

async function main() {
  await cleanup();
  const prevSettings = (await sql(`SELECT key, value FROM app_settings`)).rows;
  const setSetting = (k, v) =>
    sql(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [k, String(v)],
    );
  await setSetting("trial_days", 14);
  await setSetting("trial_days_existing", 14);

  start(3101, true);
  start(3102, false);
  await waitFor(ON);
  await waitFor(OFF);

  /* ---------- planes a la venta ---------- */
  const u0 = await newUser(ON, "a");
  const s0 = await sub(u0);
  const monthly = (s0.plans || []).find((p) => p.code === "monthly");
  const annual = (s0.plans || []).find((p) => p.code === "annual");
  ok("planes: mensual 2,50 / 30 días", monthly && monthly.price_usd === 2.5 && monthly.days === 30, s0.plans);
  ok("planes: anual 20 / 365 días", annual && annual.price_usd === 20 && annual.days === 365, s0.plans);

  /* ---------- usuario nuevo: prueba con todo ---------- */
  ok("verificar correo → plan prueba", u0.sub.plan === "trial" && u0.sub.enabled === true, u0.sub);
  ok("prueba de 14 días", u0.sub.trial_days_left === 14, u0.sub.trial_days_left);
  ok("prueba: todas las funciones", Object.values(u0.sub.features).every(Boolean), u0.sub.features);
  const { rows: ur } = await sql(`SELECT trial_days_granted FROM users WHERE id = $1`, [u0.id]);
  ok("se guardan los días de prueba concedidos", ur[0].trial_days_granted === 14, ur[0]);

  // Datos de ejemplo durante la prueba
  const ent = async (u, name) => (await api(u, "POST", "/api/entities", { name, kind: "banco", currency: "usd", initial_amount: 100 }));
  const e1 = await ent(u0, "QA Uno");
  const e2 = await ent(u0, "QA Dos");
  ok("prueba: 2 entidades", e1.s === 201 && e2.s === 201, [e1.s, e2.s]);
  const L = (await api(u0, "GET", "/api/ledger")).j;
  const cat = (type) => L.categories.find((c) => c.type === type && !c.own);
  const own = await api(u0, "POST", "/api/categories", { type: "expense", name: "QA propia", icon: "more" });
  ok("prueba: crear categoría propia", own.s === 201, own);
  const tr = await api(u0, "POST", "/api/transfers", { from_entity_id: e1.j.id, to_entity_id: e2.j.id, amount: 5, currency: "USD" });
  ok("prueba: transferir", tr.s === 201, tr);
  const debt = await api(u0, "POST", "/api/transactions", { category_id: cat("loan_given").id, amount: 50, currency: "USD", description: "QA deuda", cash: false });
  ok("prueba: crear por cobrar", debt.s === 201, debt);
  const pay = await api(u0, "POST", `/api/transactions/${debt.j.id}/payments`, { amount: 10, currency: "USD", entity_id: e1.j.id });
  ok("prueba: abono", pay.s === 201, pay);
  const plan = await api(u0, "POST", "/api/planned", { name: "QA plan", category_id: cat("expense").id });
  ok("prueba: gasto planificado", plan.s === 201, plan);
  const withItems = await api(u0, "POST", "/api/transactions", { category_id: cat("expense").id, amount: 4, currency: "USD", entity_id: e1.j.id, items: [{ name: "Queso", amount: 4, quantity: 1 }] });
  ok("prueba: movimiento con ítems", withItems.s === 201, withItems);
  const withOwn = await api(u0, "POST", "/api/transactions", { category_id: own.j.id, amount: 3, currency: "USD", entity_id: e1.j.id });
  ok("prueba: movimiento con categoría propia", withOwn.s === 201, withOwn);
  const withRec = await api(u0, "POST", "/api/transactions", { category_id: cat("expense").id, amount: 2, currency: "USD", entity_id: e1.j.id, receipt_name: "r.png", receipt_data: "data:image/png;base64,AAAA" });
  ok("prueba: movimiento con recibo", withRec.s === 201, withRec);
  ok("prueba: estadísticas por categoría", (await api(u0, "GET", "/api/stats/by-category")).s === 200);
  ok("prueba: tendencia", (await api(u0, "GET", "/api/stats/trend")).s === 200);

  /* ---------- la prueba vence → Gratis ---------- */
  await sql(`UPDATE users SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [u0.id]);
  const f = await sub(u0);
  ok("vencida → plan gratis", f.plan === "free", f);
  ok("gratis: ninguna función Premium", Object.values(f.features).every((v) => v === false), f.features);
  ok("gratis: la 2.ª entidad queda bloqueada", JSON.stringify(f.locked_entity_ids) === JSON.stringify([e2.j.id]), f.locked_entity_ids);
  ok("gratis: tope de 1 entidad", f.max_entities === 1);

  ok("gratis: no crea 2.ª entidad", isPlan402(await ent(u0, "QA Tres"), "multi_entity"));
  ok("gratis: no transfiere", isPlan402(await api(u0, "POST", "/api/transfers", { from_entity_id: e1.j.id, to_entity_id: e2.j.id, amount: 1, currency: "USD" }), "transfers"));
  ok("gratis: no crea por cobrar", isPlan402(await api(u0, "POST", "/api/transactions", { category_id: cat("loan_given").id, amount: 5, currency: "USD", cash: false }), "debts"));
  ok("gratis: no abona", isPlan402(await api(u0, "POST", `/api/transactions/${debt.j.id}/payments`, { amount: 1, currency: "USD", entity_id: e1.j.id }), "debts"));
  ok("gratis: no edita una deuda", isPlan402(await api(u0, "PUT", `/api/transactions/${debt.j.id}`, { amount: 60 }), "debts"));
  ok("gratis: no crea planificados", isPlan402(await api(u0, "POST", "/api/planned", { name: "otro" }), "planned"));
  ok("gratis: no edita planificados", isPlan402(await api(u0, "PUT", `/api/planned/${plan.j.id}`, { name: "x" }), "planned"));
  ok("gratis: no crea categorías propias", isPlan402(await api(u0, "POST", "/api/categories", { type: "expense", name: "Otra", icon: "more" }), "custom_categories"));
  ok("gratis: no edita categorías propias", isPlan402(await api(u0, "PUT", `/api/categories/${own.j.id}`, { name: "Nueva" }), "custom_categories"));
  ok("gratis: no registra con categoría propia", isPlan402(await api(u0, "POST", "/api/transactions", { category_id: own.j.id, amount: 1, currency: "USD", entity_id: e1.j.id }), "custom_categories"));
  ok("gratis: no registra con ítems", isPlan402(await api(u0, "POST", "/api/transactions", { category_id: cat("expense").id, amount: 1, currency: "USD", entity_id: e1.j.id, items: [{ name: "Pan", amount: 1 }] }), "items"));
  ok("gratis: no registra con recibo", isPlan402(await api(u0, "POST", "/api/transactions", { category_id: cat("expense").id, amount: 1, currency: "USD", entity_id: e1.j.id, receipt_name: "r.png", receipt_data: "data:image/png;base64,AAAA" }), "receipts"));
  ok("gratis: no registra en entidad bloqueada", isPlan402(await api(u0, "POST", "/api/transactions", { category_id: cat("expense").id, amount: 1, currency: "USD", entity_id: e2.j.id }), "locked_entity"));
  ok("gratis: no ajusta una entidad bloqueada", isPlan402(await api(u0, "POST", "/api/adjustments", { entity_id: e2.j.id, amount: 5 }), "locked_entity"));
  ok("gratis: no archiva", isPlan402(await api(u0, "POST", `/api/entities/${e2.j.id}/archive`, {}), "multi_entity"));
  ok("gratis: no restaura", isPlan402(await api(u0, "POST", `/api/entities/${e2.j.id}/restore`, {}), "multi_entity"));
  ok("gratis: estadísticas por categoría bloqueadas", isPlan402(await api(u0, "GET", "/api/stats/by-category"), "full_stats"));
  ok("gratis: tendencia bloqueada", isPlan402(await api(u0, "GET", "/api/stats/trend"), "full_stats"));

  // Lo que sí puede en Gratis
  const gOk = await api(u0, "POST", "/api/transactions", { category_id: cat("expense").id, amount: 1, currency: "USD", entity_id: e1.j.id });
  ok("gratis: registra un gasto simple en su entidad activa", gOk.s === 201, gOk);
  const gInc = await api(u0, "POST", "/api/transactions", { category_id: cat("income").id, amount: 9, currency: "USD", entity_id: e1.j.id });
  ok("gratis: registra un ingreso", gInc.s === 201, gInc);
  ok("gratis: ajusta el saldo de su entidad activa", (await api(u0, "POST", "/api/adjustments", { entity_id: e1.j.id, amount: 2 })).s === 201);
  ok("gratis: estadísticas básicas (summary)", (await api(u0, "GET", "/api/stats/summary")).s === 200);
  ok("gratis: puede ocultar categorías", (await api(u0, "PUT", `/api/categories/${cat("expense").id}/visibility`, { hidden: true })).s === 200);
  const Lf = (await api(u0, "GET", "/api/ledger")).j;
  ok("gratis: el ledger trae el plan", Lf.subscription && Lf.subscription.plan === "free", Lf.subscription);
  ok("gratis: no se borra nada (2 entidades, deuda, plan, categoría propia)",
    Lf.entities.length === 2 && Lf.transactions.some((t) => t.id === debt.j.id) && Lf.planned.length === 1 && Lf.categories.some((c) => c.id === own.j.id),
    { ents: Lf.entities.length, planned: Lf.planned.length });
  ok("gratis: puede eliminar una deuda", (await api(u0, "DELETE", `/api/transactions/${debt.j.id}`)).s === 200);
  ok("/auth/me trae el plan", (await api(u0, "GET", "/api/auth/me")).j.subscription.plan === "free");
  const lg = await call(ON, "POST", "/api/auth/login", { email: u0.email, password: "Prueba1234!" });
  ok("login trae el plan", lg.j.subscription && lg.j.subscription.plan === "free", lg.j);

  /* ---------- Premium ---------- */
  await sql(`UPDATE users SET premium_until = NOW() + INTERVAL '30 days' WHERE id = $1`, [u0.id]);
  const p = await sub(u0);
  ok("premium → plan premium", p.plan === "premium", p);
  ok("premium: sin entidades bloqueadas ni tope", p.locked_entity_ids.length === 0 && p.max_entities === null, p);
  ok("premium: crea 3.ª entidad", (await ent(u0, "QA Tres")).s === 201);
  ok("premium: transfiere", (await api(u0, "POST", "/api/transfers", { from_entity_id: e1.j.id, to_entity_id: e2.j.id, amount: 1, currency: "USD" })).s === 201);
  ok("premium: registra en la entidad que estaba bloqueada", (await api(u0, "POST", "/api/transactions", { category_id: cat("expense").id, amount: 1, currency: "USD", entity_id: e2.j.id })).s === 201);
  ok("premium: usa su categoría propia otra vez", (await api(u0, "POST", "/api/transactions", { category_id: own.j.id, amount: 1, currency: "USD", entity_id: e1.j.id })).s === 201);
  ok("premium: estadísticas completas", (await api(u0, "GET", "/api/stats/by-category")).s === 200);

  // Premium vencido y prueba vencida → Gratis otra vez
  await sql(`UPDATE users SET premium_until = NOW() - INTERVAL '1 day' WHERE id = $1`, [u0.id]);
  ok("premium vencido → gratis", (await sub(u0)).plan === "free");
  // La prueba vigente y premium vencido → prueba
  await sql(`UPDATE users SET trial_ends_at = NOW() + INTERVAL '5 days' WHERE id = $1`, [u0.id]);
  ok("prueba vigente con premium vencido → prueba", (await sub(u0)).plan === "trial");

  /* ---------- días de prueba ajustables ---------- */
  await setSetting("trial_days", 3);
  const uA = await newUser(ON, "b");
  ok("trial_days=3 → usuario nuevo con 3 días", uA.sub.trial_days_left === 3, uA.sub);
  const endBefore = (await sql(`SELECT trial_ends_at FROM users WHERE id = $1`, [uA.id])).rows[0].trial_ends_at.getTime();

  await setSetting("trial_days", 30);
  const uB = await newUser(ON, "c");
  ok("subir a 30 → el nuevo recibe 30", uB.sub.trial_days_left === 30, uB.sub);
  const endAfter = (await sql(`SELECT trial_ends_at FROM users WHERE id = $1`, [uA.id])).rows[0].trial_ends_at.getTime();
  ok("el cambio no altera la prueba de quien ya la tenía", endBefore === endAfter && (await sub(uA)).trial_days_left === 3);

  await setSetting("trial_days", 0);
  const uC = await newUser(ON, "d");
  ok("trial_days=0 → sin prueba: entra directo en Gratis", uC.sub.plan === "free" && uC.sub.trial_days_left === 0, uC.sub);
  ok("trial_days=0 queda registrado (0 días concedidos)", (await sql(`SELECT trial_days_granted FROM users WHERE id = $1`, [uC.id])).rows[0].trial_days_granted === 0);

  await setSetting("trial_days", "abc");
  ok("valor inválido → usa 14", (await newUser(ON, "e")).sub.trial_days_left === 14);
  await setSetting("trial_days", -5);
  ok("valor negativo → usa 14", (await newUser(ON, "f")).sub.trial_days_left === 14);
  await setSetting("trial_days", 999);
  ok("valor mayor a 365 → se limita a 365", (await newUser(ON, "g")).sub.trial_days_left === 365);
  await setSetting("trial_days", 14);

  /* ---------- usuario anterior a la función ---------- */
  await setSetting("trial_days_existing", 7);
  const uOld = await newUser(OFF, "h"); // se registra con la función apagada: sin prueba
  const offRow = (await sql(`SELECT trial_days_granted, trial_ends_at FROM users WHERE id = $1`, [uOld.id])).rows[0];
  ok("función apagada: no se concede prueba al verificar", offRow.trial_days_granted === null && offRow.trial_ends_at === null, offRow);
  const oldOn = await sub({ ...uOld, base: ON });
  ok("al encender: prueba de trial_days_existing (7 días) desde el primer uso", oldOn.plan === "trial" && oldOn.trial_days_left === 7, oldOn);
  ok("la prueba de un usuario anterior se concede una sola vez", (await sub({ ...uOld, base: ON })).trial_days_left === 7);
  await setSetting("trial_days_existing", 14);

  /* ---------- recuperar contraseña de una cuenta sin verificar ---------- */
  const email = EMAIL("r");
  const reg = await call(ON, "POST", "/api/auth/register", { name: "QA r", email, password: "Prueba1234!" });
  await sql(`UPDATE email_verification_codes SET created_at = NOW() - INTERVAL '5 minutes' WHERE user_id = (SELECT id FROM users WHERE email = $1)`, [email]);
  const fp = await call(ON, "POST", "/api/auth/forgot-password", { email });
  const rp = await call(ON, "POST", "/api/auth/reset-password", { email, code: fp.j.dev_code, password: "Nueva1234!" });
  ok("restablecer contraseña de una cuenta sin verificar", rp.s === 200 && reg.s === 201, [rp.s, fp.j]);
  const rr = (await sql(`SELECT trial_days_granted FROM users WHERE email = $1`, [email])).rows[0];
  ok("…y empieza su prueba", rr.trial_days_granted === 14, rr);

  /* ---------- función apagada: todo como hoy ---------- */
  const uOff = await newUser(OFF, "i");
  const so = await sub(uOff);
  ok("apagada: plan premium, enabled=false", so.plan === "premium" && so.enabled === false, so);
  ok("apagada: todas las funciones", Object.values(so.features).every(Boolean));
  const o1 = await ent(uOff, "QA Off 1");
  const o2 = await ent(uOff, "QA Off 2");
  ok("apagada: crea varias entidades", o1.s === 201 && o2.s === 201);
  const Lo = (await api(uOff, "GET", "/api/ledger")).j;
  const catO = (type) => Lo.categories.find((c) => c.type === type && !c.own);
  ok("apagada: transfiere", (await api(uOff, "POST", "/api/transfers", { from_entity_id: o1.j.id, to_entity_id: o2.j.id, amount: 1, currency: "USD" })).s === 201);
  ok("apagada: crea por cobrar", (await api(uOff, "POST", "/api/transactions", { category_id: catO("loan_given").id, amount: 5, currency: "USD", cash: false })).s === 201);
  ok("apagada: planificados", (await api(uOff, "POST", "/api/planned", { name: "QA off" })).s === 201);
  ok("apagada: categorías propias", (await api(uOff, "POST", "/api/categories", { type: "expense", name: "QA off", icon: "more" })).s === 201);
  ok("apagada: estadísticas completas", (await api(uOff, "GET", "/api/stats/by-category")).s === 200);
  ok("apagada: el ledger trae enabled=false", (await api(uOff, "GET", "/api/ledger")).j.subscription.enabled === false);
}

(async () => {
  try {
    await main();
  } catch (e) {
    fail++;
    console.log("ERROR en la prueba:", e.message);
  } finally {
    try {
      await cleanup();
      // Deja la configuración como estaba
      await sql(`UPDATE app_settings SET value = '14' WHERE key IN ('trial_days','trial_days_existing')`);
    } catch (e) {
      console.log("No se pudo limpiar:", e.message);
    }
    servers.forEach((s) => s.kill());
    await pool.end();
    console.log(`\n${pass} correctas, ${fail} con fallo`);
    process.exit(fail ? 1 : 0);
  }
})();
