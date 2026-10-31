/**
 * Pruebas de la API por modo (Venezuela = multi, resto = single). Sin dependencias: Node 18+.
 *
 *   API_URL=http://localhost:3011/api node tests/multi-pais.test.js
 *
 * Crea usuarios de prueba (qa-*@test.local) y los borra al terminar con la misma base que usa la
 * API (variables DB_*). Se niega a correr contra producción: la API debe responder env != production
 * y DB_HOST debe ser local. Arranca la API con la base local y NODE_ENV=development (así el registro
 * devuelve `dev_code`).
 */
const BASE = (process.env.API_URL || "http://localhost:3011/api").replace(/\/$/, "");
const ROOT = BASE.replace(/\/api$/, "");
const RUN = Date.now().toString(36);

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log("  ok   " + name);
  } else {
    fail++;
    failures.push(name);
    console.log("  FALLA " + name + (extra !== undefined ? "  → " + JSON.stringify(extra) : ""));
  }
}

async function http(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  return { status: res.status, data };
}

async function makeUser(country) {
  const email = `qa-${(country || "ve").toLowerCase()}-${RUN}@test.local`;
  const reg = await http("POST", "/auth/register", null, {
    name: "QA " + (country || "VE"),
    email,
    password: "Qa123456!",
    ...(country ? { country } : {}),
  });
  if (reg.status !== 201 || !reg.data.dev_code)
    throw new Error("No se pudo registrar " + email + ": " + JSON.stringify(reg));
  const ver = await http("POST", "/auth/verify-email", null, {
    email,
    code: reg.data.dev_code,
  });
  if (!ver.data?.token) throw new Error("No se pudo verificar " + email);
  return { email, token: ver.data.token, user: ver.data.user };
}

const catOf = async (token, type) => {
  const l = await http("GET", "/ledger", token);
  return l.data.categories.find((c) => c.type === type).id;
};
const today = () => new Date().toISOString().slice(0, 10);

async function runSingle() {
  console.log("\n== Modo single (Colombia)");
  const u = await makeUser("CO");
  const t = u.token;
  check("registro CO: país, modo y moneda base", u.user.country === "CO" && u.user.mode === "single" && u.user.base_currency === "COP", u.user);

  const me = await http("GET", "/auth/me", t);
  check("/auth/me devuelve país, modo y moneda", me.data.country === "CO" && me.data.mode === "single" && me.data.base_currency === "COP", me.data);

  const bad = await http("PATCH", "/auth/me", t, { name: "QA CO 2", country: "VE", mode: "multi" });
  const me2 = await http("GET", "/auth/me", t);
  check("PATCH /auth/me no cambia el país ni el modo", me2.data.country === "CO" && me2.data.mode === "single", { bad, me2: me2.data });

  // Tasas
  const r1 = await http("GET", "/exchange-rates", t);
  check("GET /exchange-rates responde sin tasas", r1.status === 200 && r1.data.usd_to_ves === 0, r1);
  check("PUT /exchange-rates → 403", (await http("PUT", "/exchange-rates", t, { usd_to_ves: 100 })).status === 403);
  check("POST /exchange-rates/fetch → 403", (await http("POST", "/exchange-rates/fetch", t)).status === 403);

  // Entidades (la moneda se fuerza a la base)
  const e1 = await http("POST", "/entities", t, { name: "Bancolombia", kind: "banco", currency: "ves", initial_amount: 1000000 });
  const e2 = await http("POST", "/entities", t, { name: "Efectivo", kind: "efectivo", currency: "usdt", initial_amount: 50000 });
  check("entidad: moneda forzada a la base y saldo inicial sin conversión", e1.status === 201 && e1.data.currency === "usd" && Number(e1.data.initial_usd) === 1000000, e1.data);
  check("segunda entidad también en la base", e2.status === 201 && e2.data.currency === "usd" && Number(e2.data.initial_usd) === 50000, e2.data);

  // Movimientos
  const exp = await catOf(t, "expense");
  const inc = await catOf(t, "income");
  const owed = await catOf(t, "loan_given");
  const debt = await catOf(t, "debt");
  const g = await http("POST", "/transactions", t, { category_id: exp, amount: 45000, currency: "USD", description: "Mercado", date: today(), entity_id: e1.data.id, items: [{ name: "Arroz", amount: 9000, quantity: 3 }, { name: "Leche" }] });
  check("gasto en moneda base: sin valores en VES/USDT", g.status === 201 && Number(g.data.amount_usd) === 45000 && Number(g.data.amount_ves) === 0 && Number(g.data.amount_binance) === 0, g.data);
  check("gasto en VES → 422", (await http("POST", "/transactions", t, { category_id: exp, amount: 1000, currency: "VES", date: today() })).status === 422);
  check("gasto en BINANCE → 422", (await http("POST", "/transactions", t, { category_id: exp, amount: 1000, currency: "BINANCE", date: today() })).status === 422);
  const i = await http("POST", "/transactions", t, { category_id: inc, amount: 2500000, currency: "USD", description: "Sueldo", date: today(), entity_id: e1.data.id });
  check("ingreso", i.status === 201 && Number(i.data.amount_usd) === 2500000, i.data);

  // Por cobrar con cuotas y abonos
  const d = await http("POST", "/transactions", t, { category_id: owed, amount: 300000, currency: "USD", counterpart_name: "Ana", date: today(), due_date: today(), installments: 3, installment_days: 15, entity_id: e1.data.id, cash: true });
  check("por cobrar con 3 cuotas", d.status === 201 && d.data.installments === 3, d.data);
  const p1 = await http("POST", `/transactions/${d.data.id}/payments`, t, { amount: 100000, currency: "USD", entity_id: e2.data.id, date: today() });
  check("abono en moneda base: factor 1 y sin VES/USDT", p1.status === 201 && Number(p1.data.amount_usd) === 100000 && Number(p1.data.amount_ves) === 0, p1.data);
  check("abono en VES → 422", (await http("POST", `/transactions/${d.data.id}/payments`, t, { amount: 10, currency: "VES", date: today() })).status === 422);
  const edit = await http("PUT", `/transactions/${d.data.id}`, t, { amount: 50000 });
  check("editar la deuda por debajo de lo abonado → 422 (arreglo de isDebt)", edit.status === 422, edit);
  const p2 = await http("POST", `/transactions/${d.data.id}/payments`, t, { amount: 200000, currency: "USD", entity_id: e2.data.id, date: today() });
  check("segundo abono salda la deuda", p2.status === 201);
  check("eliminar un abono", (await http("DELETE", `/transactions/${d.data.id}/payments/${p2.data.id}`, t)).status === 200);

  // Por pagar recurrente: al saldarse crea la del mes siguiente sin tasas
  const r = await http("POST", "/transactions", t, { category_id: debt, amount: 80000, currency: "USD", counterpart_name: "Arriendo", date: today(), due_date: today(), recurring: true, cash: false });
  check("por pagar recurrente", r.status === 201 && r.data.recurring === true, r.data);
  const rp = await http("POST", `/transactions/${r.data.id}/payments`, t, { amount: 80000, currency: "USD", entity_id: e1.data.id, date: today() });
  check("al saldar se crea la deuda del mes siguiente en moneda base", rp.status === 201 && rp.data.next_recurrence && rp.data.next_recurrence.id, rp.data);
  const l0 = await http("GET", "/ledger", t);
  const nextDebt = l0.data.transactions.find((x) => x.id === rp.data.next_recurrence?.id);
  check("la deuda nueva conserva el monto y no tiene VES/USDT", nextDebt && Number(nextDebt.amount_usd) === 80000 && Number(nextDebt.amount_ves) === 0, nextDebt);

  // Transferencia con comisión
  const tr = await http("POST", "/transfers", t, { from_entity_id: e1.data.id, to_entity_id: e2.data.id, amount: 100000, fee: 2000, currency: "USD", date: today() });
  check("transferencia con comisión en moneda base", tr.status === 201 && Number(tr.data.amount_usd) === 100000 && Number(tr.data.fee_usd) === 2000 && !Number(tr.data.amount_ves || 0) && !Number(tr.data.amount_binance || 0), tr.data);
  check("transferencia en VES → 422", (await http("POST", "/transfers", t, { from_entity_id: e1.data.id, to_entity_id: e2.data.id, amount: 1, currency: "VES" })).status === 422);

  // Gastos planificados
  const pl = await http("POST", "/planned", t, { name: "Compra del mes", category_id: exp, currency: "USD", items: [{ name: "Arroz", amount: 9000, quantity: 2 }] });
  check("plan en moneda base", pl.status === 201 && pl.data.currency === "USD", pl.data);
  check("plan en VES → 422", (await http("POST", "/planned", t, { name: "X", currency: "VES", amount: 5 })).status === 422);
  check("plan en BINANCE → 422", (await http("POST", "/planned", t, { name: "X", currency: "BINANCE", amount: 5 })).status === 422);

  // Ledger
  const l = await http("GET", "/ledger", t);
  const mercado = l.data.transactions.find((x) => x.description === "Mercado");
  check("/ledger: sin tasas", l.status === 200 && l.data.rates.usd_to_ves === 0 && l.data.rates.binance_to_ves === 0, l.data.rates);
  check("/ledger: ítems con cantidad (y 1 por defecto)", mercado && mercado.items.find((x) => x.name === "Arroz")?.quantity === 3 && mercado.items.find((x) => x.name === "Leche")?.quantity === 1, mercado?.items);

  check("registro con país inexistente → 422", (await http("POST", "/auth/register", null, { name: "QA", email: `qa-xx-${RUN}@test.local`, password: "Qa123456!", country: "XX" })).status === 422);
  return u;
}

async function runMulti() {
  console.log("\n== Modo multi (Venezuela, sin país en el registro)");
  const u = await makeUser(null);
  const t = u.token;
  check("sin país se asume Venezuela, modo multi", u.user.country === "VE" && u.user.mode === "multi" && u.user.base_currency === "USD", u.user);

  check("PUT /exchange-rates funciona", (await http("PUT", "/exchange-rates", t, { usd_to_ves: 100, binance_to_ves: 110 })).status === 200);
  const e = await http("POST", "/entities", t, { name: "Banesco", kind: "banco", currency: "ves", initial_amount: 100000 });
  check("entidad en VES: saldo inicial convertido con la tasa", e.status === 201 && e.data.currency === "ves" && Math.abs(Number(e.data.initial_usd) - 1000) < 0.01, e.data);

  const exp = await catOf(t, "expense");
  const debtCat = await catOf(t, "debt");
  const g = await http("POST", "/transactions", t, { category_id: exp, amount: 1000, currency: "VES", description: "Café", date: today(), entity_id: e.data.id });
  check("gasto en VES: USD = VES / tasa y USDT con la tasa Binance", g.status === 201 && Math.abs(Number(g.data.amount_usd) - 10) < 0.01 && Math.abs(Number(g.data.amount_binance) - 1000 / 110) < 0.01 && Number(g.data.amount_ves) === 1000, g.data);
  const gb = await http("POST", "/transactions", t, { category_id: exp, amount: 5, currency: "BINANCE", date: today() });
  check("gasto en USDT", gb.status === 201 && Number(gb.data.amount_binance) === 5, gb.data);
  const ed = await http("PUT", `/transactions/${g.data.id}`, t, { amount: 2000 });
  check("editar un gasto conserva las tasas del día", ed.status === 200 && Math.abs(Number(ed.data.amount_usd) - 20) < 0.01, ed.data);

  const d = await http("POST", "/transactions", t, { category_id: debtCat, amount: 600, currency: "USD", counterpart_name: "Banco", date: today(), due_date: today(), installments: 3, installment_days: 15, cash: false });
  const p = await http("POST", `/transactions/${d.data.id}/payments`, t, { amount: 10000, currency: "VES", date: today() });
  check("abono en VES a una deuda en USD", p.status === 201 && Math.abs(Number(p.data.amount_usd) - 100) < 0.01, p.data);
  check("editar la deuda por debajo de lo abonado → 422", (await http("PUT", `/transactions/${d.data.id}`, t, { amount: 50 })).status === 422);
  check("cambiar la moneda con abonos → 422", (await http("PUT", `/transactions/${d.data.id}`, t, { currency: "VES", amount: 60000 })).status === 422);

  const pl = await http("POST", "/planned", t, { name: "Súper", category_id: exp, currency: "VES", items: [{ name: "Queso", amount: 500, quantity: 2 }] });
  check("plan en VES", pl.status === 201 && pl.data.currency === "VES", pl.data);
  const pl2 = await http("POST", "/planned", t, { name: "Súper 2", category_id: exp, currency: "BINANCE", amount: 20 });
  check("plan en USDT", pl2.status === 201 && pl2.data.currency === "BINANCE", pl2.data);

  const l = await http("GET", "/ledger", t);
  check("/ledger con tasas", l.status === 200 && l.data.rates.usd_to_ves === 100, l.data.rates);
  return u;
}

async function cleanup(emails) {
  if (!emails.length) return;
  try {
    const { Pool } = require("pg");
    const pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    });
    const r = await pool.query("DELETE FROM users WHERE email = ANY($1)", [emails]);
    await pool.end();
    console.log(`\nLimpieza: ${r.rowCount} usuarios de prueba borrados`);
  } catch (err) {
    console.log("\nNo se pudieron borrar los usuarios de prueba:", err.message, "→ emails:", emails.join(", "));
  }
}

(async () => {
  // Seguridad: nunca contra producción
  const health = await fetch(ROOT + "/health").then((r) => r.json()).catch(() => null);
  const host = String(process.env.DB_HOST || "localhost");
  if (!health) {
    console.error("La API no responde en " + ROOT);
    process.exitCode = 2;
    return;
  }
  if (health.env === "production" || !/^(localhost|127\.0\.0\.1)$/.test(host)) {
    console.error(`Se niega a correr: la API responde env=${health.env} y DB_HOST=${host}. Usa la API y la base LOCALES.`);
    process.exitCode = 2;
    return;
  }

  const emails = [];
  try {
    const co = await runSingle();
    emails.push(co.email, `qa-xx-${RUN}@test.local`);
    const ve = await runMulti();
    emails.push(ve.email);
  } catch (err) {
    fail++;
    failures.push("excepción: " + err.message);
    console.error(err);
  }
  await cleanup(emails);
  console.log(`\nResultado: ${pass} ok, ${fail} con fallas`);
  if (fail) console.log("Fallas:\n - " + failures.join("\n - "));
  process.exitCode = fail ? 1 : 0;
})();
