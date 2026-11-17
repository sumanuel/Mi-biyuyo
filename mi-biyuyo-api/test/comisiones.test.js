// Pruebas de comisiones bancarias (reglas por entidad, comisión en gastos y pagos de por pagar)
// contra la base LOCAL. Puertos 3104 (todo Premium) y 3105 (suscripciones encendidas).
//   npm run test:comisiones
require("../src/config/loadEnv");
const { spawn } = require("child_process");
const path = require("path");
const pool = require("../src/config/database");

if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)) {
  console.log("ABORTO: la base no es local (" + process.env.DB_HOST + ")");
  process.exit(1);
}
let pass = 0;
let fail = 0;
const ok = (name, cond, extra) => {
  if (cond) pass++;
  else {
    fail++;
    console.log("  FALLA", name, extra !== undefined ? JSON.stringify(extra) : "");
  }
};
const call = async (base, token, method, p, body) => {
  const r = await fetch(base + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
};
const servers = [];
const start = (port, env) =>
  servers.push(spawn(process.execPath, [path.join(__dirname, "../src/index.js")], { env: { ...process.env, PORT: String(port), ...env }, stdio: "ignore" }));
const waitFor = async (base) => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base + "/health")).ok) return; } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
  }
};
const newUser = async (base, label) => {
  const email = `qa-comis-${Date.now()}-${label}@mibiyuyo.test`;
  const reg = await call(base, null, "POST", "/api/auth/register", { name: "QA " + label, email, password: "Prueba1234!" });
  const v = await call(base, null, "POST", "/api/auth/verify-email", { email, code: reg.j.dev_code });
  await call(base, v.j.token, "PUT", "/api/exchange-rates", { usd_to_ves: 100, binance_to_ves: 100 });
  return { token: v.j.token, email };
};
const feeRows = async (txId) => (await pool.query(`SELECT * FROM bank_fees WHERE transaction_id = $1`, [txId])).rows;

async function main() {
  const A = "http://localhost:3104";
  const B = "http://localhost:3105";
  start(3104, { SUBSCRIPTIONS_ENABLED: "false" });
  start(3105, { SUBSCRIPTIONS_ENABLED: "true" });
  try {
    await waitFor(A);
    await waitFor(B);
    const u = await newUser(A, "a");
    const t = u.token;
    const rules = { pago_movil: { pct: 0.3, min: 14, max: null }, transferencia: { pct: 0.1, min: 14, max: 68 } };
    const ent = (await call(A, t, "POST", "/api/entities", { name: "Banco QA", kind: "banco", currency: "ves", initial_amount: 100000, fee_rules: rules })).j;
    ok("la entidad guarda las reglas", ent.fee_rules && ent.fee_rules.pago_movil.pct === 0.3 && ent.fee_rules.transferencia.max === 68, ent);
    ok("pct > 25 → 422", (await call(A, t, "PUT", `/api/entities/${ent.id}`, { name: "Banco QA", kind: "banco", currency: "ves", fee_rules: { pago_movil: { pct: 30 } } })).s === 422);
    ok("máximo menor al mínimo → 422", (await call(A, t, "PUT", `/api/entities/${ent.id}`, { name: "Banco QA", kind: "banco", currency: "ves", fee_rules: { transferencia: { pct: 1, min: 20, max: 10 } } })).s === 422);
    const kept = await call(A, t, "PUT", `/api/entities/${ent.id}`, { name: "Banco QA 2", kind: "banco", currency: "ves" });
    ok("editar sin fee_rules conserva las reglas", kept.s === 200 && kept.j.fee_rules && kept.j.fee_rules.pago_movil.min === 14, kept.j);
    const cleared = await call(A, t, "PUT", `/api/entities/${ent.id}`, { name: "Banco QA 2", kind: "banco", currency: "ves", fee_rules: null });
    ok("fee_rules null las quita", cleared.s === 200 && cleared.j.fee_rules === null);
    await call(A, t, "PUT", `/api/entities/${ent.id}`, { name: "Banco QA 2", kind: "banco", currency: "ves", fee_rules: rules });

    const cats = (await call(A, t, "GET", "/api/categories")).j;
    const list = Array.isArray(cats) ? cats : cats.categories;
    const gasto = list.find((c) => c.type === "expense");
    const ingreso = list.find((c) => c.type === "income");
    const deuda = list.find((c) => c.type === "debt");
    const mk = (over) => call(A, t, "POST", "/api/transactions", { category_id: gasto.id, amount: 1000, currency: "VES", entity_id: ent.id, date: "2026-11-05", ...over });

    ok("método inválido → 422", (await mk({ fee: { method: "cheque", amount: 14 } })).s === 422);
    ok("comisión sin entidad → 422", (await mk({ entity_id: null, fee: { method: "pago_movil", amount: 14 } })).s === 422);
    ok("comisión en un ingreso → 422", (await mk({ category_id: ingreso.id, fee: { method: "pago_movil", amount: 14 } })).s === 422);
    const g = await mk({ fee: { method: "pago_movil", amount: 14 } });
    ok("gasto con comisión se crea", g.s === 201);
    const fr = await feeRows(g.j.id);
    ok("se guarda la comisión", fr.length === 1 && Number(fr[0].amount) === 14 && fr[0].method === "pago_movil" && fr[0].entity_id === ent.id && fr[0].currency === "VES", fr);
    ok("la comisión se convierte a USD", Number(fr[0].amount_usd) >= 0);
    const led = (await call(A, t, "GET", "/api/ledger")).j;
    ok("el ledger devuelve fees y fee_rules", led.fees.length === 1 && led.fees[0].transaction_id === g.j.id && led.entities.find((e) => e.id === ent.id).fee_rules.pago_movil.pct === 0.3, led.fees);
    const g0 = await mk({});
    ok("sin fee no se crea comisión", (await feeRows(g0.j.id)).length === 0);

    const up = await call(A, t, "PUT", `/api/transactions/${g.j.id}`, { fee: { method: "transferencia", amount: 20 } });
    const fr2 = await feeRows(g.j.id);
    ok("editar reemplaza la comisión", up.s === 200 && fr2.length === 1 && Number(fr2[0].amount) === 20 && fr2[0].method === "transferencia", fr2);
    await call(A, t, "PUT", `/api/transactions/${g.j.id}`, { fee: null });
    ok("fee null la quita", (await feeRows(g.j.id)).length === 0);
    await call(A, t, "PUT", `/api/transactions/${g.j.id}`, { fee: { method: "pago_movil", amount: 14 } });
    const ent2 = (await call(A, t, "POST", "/api/entities", { name: "Otro QA", kind: "banco", currency: "ves" })).j;
    await call(A, t, "PUT", `/api/transactions/${g.j.id}`, { entity_id: ent2.id });
    ok("cambiar de entidad sin reenviar la comisión la quita", (await feeRows(g.j.id)).length === 0);
    await call(A, t, "PUT", `/api/transactions/${g.j.id}`, { entity_id: ent.id, fee: { method: "pago_movil", amount: 14 } });
    await call(A, t, "DELETE", `/api/transactions/${g.j.id}`);
    ok("borrar el gasto borra su comisión", (await feeRows(g.j.id)).length === 0);

    // Pagos de por pagar (deuda a crédito)
    const d = await call(A, t, "POST", "/api/transactions", { category_id: deuda.id, amount: 500, currency: "VES", cash: false, date: "2026-11-05", due_date: "2026-12-05" });
    ok("comisión en el pago de una deuda", (await call(A, t, "POST", `/api/transactions/${d.j.id}/payments`, { amount: 100, currency: "VES", entity_id: ent.id, date: "2026-11-06", fee: { method: "pago_movil", amount: 14 } })).s === 201);
    const pf = (await pool.query(`SELECT bf.* FROM bank_fees bf JOIN transaction_payments p ON p.id = bf.payment_id WHERE p.transaction_id = $1`, [d.j.id])).rows;
    ok("la comisión del pago queda ligada al abono", pf.length === 1 && Number(pf[0].amount) === 14, pf);
    ok("comisión sin entidad en el pago → 422", (await call(A, t, "POST", `/api/transactions/${d.j.id}/payments`, { amount: 50, currency: "VES", fee: { method: "pago_movil", amount: 14 } })).s === 422);
    const payId = (await pool.query(`SELECT id FROM transaction_payments WHERE transaction_id = $1`, [d.j.id])).rows[0].id;
    await call(A, t, "DELETE", `/api/transactions/${d.j.id}/payments/${payId}`);
    ok("borrar el abono borra su comisión", (await pool.query(`SELECT 1 FROM bank_fees WHERE payment_id = $1`, [payId])).rows.length === 0);

    // Premium: con suscripciones encendidas, un usuario Gratis recibe 402
    const f = await newUser(B, "free");
    await pool.query(`UPDATE users SET trial_ends_at = NOW() - INTERVAL '1 day', trial_days_granted = 1 WHERE email = $1`, [f.email]);
    const fe = (await call(B, f.token, "POST", "/api/entities", { name: "Banco Free", kind: "banco", currency: "ves" })).j;
    const rf = await call(B, f.token, "PUT", `/api/entities/${fe.id}`, { name: "Banco Free", kind: "banco", currency: "ves", fee_rules: rules });
    ok("reglas de comisión son Premium (402)", rf.s === 402 && rf.j.feature === "fees", rf);
  } finally {
    servers.forEach((s) => s.kill());
    await pool.query(`DELETE FROM users WHERE email LIKE 'qa-comis-%@mibiyuyo.test'`);
    await pool.end();
  }
  console.log(`\n${pass} correctas, ${fail} con fallo`);
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => {
  console.error(e);
  servers.forEach((s) => s.kill());
  await pool.query(`DELETE FROM users WHERE email LIKE 'qa-comis-%@mibiyuyo.test'`).catch(() => {});
  process.exit(1);
});
