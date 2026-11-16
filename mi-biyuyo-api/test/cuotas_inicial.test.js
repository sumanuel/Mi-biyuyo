// Pruebas de la inicial en compras a cuotas contra la base LOCAL (puerto 3103).
// Crea un usuario qa-inicial-*@mibiyuyo.test y lo borra al final.
//   npm run test:inicial
require("../src/config/loadEnv");
const { spawn } = require("child_process");
const path = require("path");
const pool = require("../src/config/database");

if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)) {
  console.log("ABORTO: la base no es local (" + process.env.DB_HOST + ")");
  process.exit(1);
}
const BASE = "http://localhost:3103";
let pass = 0;
let fail = 0;
const ok = (name, cond, extra) => {
  if (cond) pass++;
  else {
    fail++;
    console.log("  FALLA", name, extra !== undefined ? JSON.stringify(extra) : "");
  }
};
const call = async (token, method, p, body) => {
  const r = await fetch(BASE + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
};

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, "../src/index.js")], {
    env: { ...process.env, PORT: "3103", SUBSCRIPTIONS_ENABLED: "false" },
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(BASE + "/health")).ok) break; } catch (e) {}
      await new Promise((r) => setTimeout(r, 500));
    }
    const email = `qa-inicial-${Date.now()}@mibiyuyo.test`;
    const reg = await call(null, "POST", "/api/auth/register", { name: "QA inicial", email, password: "Prueba1234!" });
    const v = await call(null, "POST", "/api/auth/verify-email", { email, code: reg.j.dev_code });
    const t = v.j.token;
    const ent = (await call(t, "POST", "/api/entities", { name: "Caja QA", kind: "cash", currency: "usd", initial_amount: 1000 })).j;
    const cats = (await call(t, "GET", "/api/categories")).j;
    const list = Array.isArray(cats) ? cats : cats.categories;
    const debtCat = list.find((c) => c.type === "debt");
    const gastoCat = list.find((c) => c.type === "expense");
    const mk = (over) => call(t, "POST", "/api/transactions", {
      category_id: debtCat.id, amount: 1000, currency: "USD", cash: false, date: "2026-11-01",
      due_date: "2026-11-16", installments: 4, installment_days: 15, ...over,
    });

    ok("inicial sin entidad → 422", (await mk({ down_payment: 200 })).s === 422);
    ok("inicial sin cuotas → 422", (await mk({ down_payment: 200, down_entity_id: ent.id, installments: null, installment_days: null })).s === 422);
    ok("inicial igual al total → 422", (await mk({ down_payment: 1000, down_entity_id: ent.id })).s === 422);
    ok("inicial con entidad ajena → 404", (await mk({ down_payment: 200, down_entity_id: 99999999 })).s === 404);

    const r = await mk({ down_payment: 200, down_entity_id: ent.id });
    ok("crea la compra con inicial", r.s === 201 && Number(r.j.down_payment) === 200, r);
    const pays = (await pool.query(`SELECT * FROM transaction_payments WHERE transaction_id = $1`, [r.j.id])).rows;
    ok("se registra un solo abono 'Inicial' de 200", pays.length === 1 && Number(pays[0].amount) === 200 && pays[0].notes === "Inicial" && pays[0].entity_id === ent.id, pays);
    ok("el abono lleva la fecha de la compra", String(pays[0].date.toISOString ? pays[0].date.toISOString().slice(0, 10) : pays[0].date).startsWith("2026-11-01") || pays[0].date.getDate() === 1);
    const led = (await call(t, "GET", "/api/ledger")).j;
    const tx = led.transactions.find((x) => x.id === r.j.id);
    ok("el ledger devuelve down_payment y el abono", tx.down_payment === 200 && tx.payments.length === 1 && tx.status === "active", tx);

    const ent2 = (await call(t, "GET", "/api/ledger")).j.entities.find((e) => e.id === ent.id);
    ok("sin inicial no se crea abono", (await (async () => { const q = await mk({}); const n = (await pool.query(`SELECT COUNT(*)::int n FROM transaction_payments WHERE transaction_id = $1`, [q.j.id])).rows[0].n; return q.s === 201 && n === 0 && (q.j.down_payment === null); })()));

    // Quitar las cuotas al editar limpia la inicial (el abono queda como abono normal)
    const up = await call(t, "PUT", `/api/transactions/${r.j.id}`, { installments: null, installment_days: null });
    ok("sin cuotas se limpia down_payment", up.s === 200 && up.j.down_payment === null, up);
    // Por cobrar con dinero que ya salió también admite inicial
    const cobrarCat = list.find((c) => c.type === "loan_given");
    const c2 = await call(t, "POST", "/api/transactions", {
      category_id: cobrarCat.id, amount: 600, currency: "USD", cash: true, entity_id: ent.id, date: "2026-11-02",
      due_date: "2026-11-17", installments: 3, installment_days: 15, down_payment: 150, down_entity_id: ent.id,
    });
    ok("por cobrar con inicial", c2.s === 201 && Number(c2.j.down_payment) === 150, c2);
    void ent2; void gastoCat;
  } finally {
    server.kill();
    await pool.query(`DELETE FROM users WHERE email LIKE 'qa-inicial-%@mibiyuyo.test'`);
    await pool.end();
  }
  console.log(`\n${pass} correctas, ${fail} con fallo`);
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => {
  console.error(e);
  await pool.query(`DELETE FROM users WHERE email LIKE 'qa-inicial-%@mibiyuyo.test'`).catch(() => {});
  process.exit(1);
});
