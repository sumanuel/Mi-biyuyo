/**
 * Datos de prueba para un usuario de un país de una sola moneda (por defecto Colombia), para probar la
 * app en modo "single". Solo en local: se niega a correr si la API responde env=production o la base
 * no es local. Es seguro repetirlo: si el usuario ya existe, no hace nada.
 *
 *   API_URL=http://localhost:3011/api node database/seed_demo_single.js            (Colombia)
 *   API_URL=http://localhost:3011/api COUNTRY=BR node database/seed_demo_single.js  (otro país)
 *
 * Usuario: demo.<país>@mibiyuyo.test / Demo1234!   (por ejemplo demo.co@mibiyuyo.test)
 * La API debe estar en modo desarrollo (así el registro devuelve `dev_code`).
 */
const BASE = (process.env.API_URL || "http://localhost:3011/api").replace(/\/$/, "");
const ROOT = BASE.replace(/\/api$/, "");
const COUNTRY = (process.env.COUNTRY || "CO").toUpperCase();
const EMAIL = `demo.${COUNTRY.toLowerCase()}@mibiyuyo.test`;
const PASSWORD = "Demo1234!";

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
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const ago = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const ahead = (n) => ago(-n);

(async () => {
  const health = await fetch(ROOT + "/health").then((r) => r.json()).catch(() => null);
  const host = String(process.env.DB_HOST || "localhost");
  if (!health) throw new Error("La API no responde en " + ROOT);
  if (health.env === "production" || !/^(localhost|127\.0\.0\.1)$/.test(host))
    throw new Error(`Se niega a correr: env=${health.env}, DB_HOST=${host}. Usa la API y la base LOCALES.`);

  // ¿Ya existe?
  const login = await fetch(BASE + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (login.ok) {
    console.log(`${EMAIL} ya existe; no se hace nada.`);
    return;
  }

  const reg = await http("POST", "/auth/register", null, { name: "Demo " + COUNTRY, email: EMAIL, password: PASSWORD, country: COUNTRY });
  const ver = await http("POST", "/auth/verify-email", null, { email: EMAIL, code: reg.dev_code });
  const t = ver.token;
  console.log("Usuario creado:", EMAIL, JSON.stringify(ver.user));

  const ledger = await http("GET", "/ledger", t);
  const cat = (type, name) => {
    const list = ledger.categories.filter((c) => c.type === type);
    return (list.find((c) => c.name === name) || list[0]).id;
  };
  const exp = (n) => cat("expense", n);
  const inc = (n) => cat("income", n);

  const banco = await http("POST", "/entities", t, { name: "Banco principal", kind: "banco", currency: "usd", initial_amount: 5000000, payment_type: "acct", payment_data: ["Banco", "Ahorros", "1234567890", "Demo"] });
  const efectivo = await http("POST", "/entities", t, { name: "Efectivo", kind: "efectivo", currency: "usd", initial_amount: 350000 });
  const billetera = await http("POST", "/entities", t, { name: "Billetera digital", kind: "digital", currency: "usd", initial_amount: 120000, alert_usd: 50000 });

  const mov = (category_id, amount, description, date, entity_id, extra = {}) =>
    http("POST", "/transactions", t, { category_id, amount, currency: "USD", description, date, entity_id, ...extra });

  // Ingresos
  await mov(inc("Sueldo"), 3200000, "Sueldo quincenal", ago(40), banco.id);
  await mov(inc("Sueldo"), 3200000, "Sueldo quincenal", ago(25), banco.id);
  await mov(inc("Sueldo"), 3200000, "Sueldo quincenal", ago(10), banco.id);
  await mov(inc("Freelance"), 650000, "Diseño de logo", ago(18), billetera.id);

  // Gastos con ítems y cantidades
  const items = (list) => list.map(([name, quantity, amount]) => ({ name, quantity, amount }));
  await mov(exp("Alimentación"), 185000, "Mercado", ago(35), banco.id, { items: items([["Arroz", 3, 18000], ["Pollo", 2, 42000], ["Leche", 6, 24000], ["Huevos", 2, 30000]]) });
  await mov(exp("Alimentación"), 142000, "Mercado", ago(21), banco.id, { items: items([["Arroz", 2, 12000], ["Pollo", 3, 63000], ["Leche", 4, 16000]]) });
  await mov(exp("Alimentación"), 96000, "Mercado", ago(7), efectivo.id, { items: items([["Pollo", 1, 21000], ["Café", 2, 28000], ["Pan", 5]]) });
  await mov(exp("Alimentación"), 38000, "Almuerzo", ago(3), efectivo.id);
  await mov(exp("Servicios"), 120000, "Internet", ago(30), banco.id);
  await mov(exp("Servicios"), 120000, "Internet", ago(1), banco.id);
  await mov(exp("Transporte"), 45000, "Gasolina", ago(14), efectivo.id);
  await mov(exp("Transporte"), 50000, "Gasolina", ago(2), efectivo.id);
  await mov(exp("Salud"), 78000, "Farmacia", ago(12), billetera.id);
  await mov(exp("Ocio"), 64000, "Cine y comida", ago(5), billetera.id);
  await mov(exp("Vivienda"), 900000, "Arriendo", ago(28), banco.id);

  // Por cobrar con cuotas y abonos
  const owed = await mov(cat("loan_given", ""), 900000, "Préstamo para el carro", ago(20), banco.id, { counterpart_name: "Carlos", due_date: ahead(10), installments: 3, installment_days: 15, cash: true });
  await http("POST", `/transactions/${owed.id}/payments`, t, { amount: 300000, currency: "USD", entity_id: banco.id, date: ago(5) });
  await mov(cat("loan_given", ""), 150000, "Adelanto", ago(9), efectivo.id, { counterpart_name: "Ana", due_date: ago(1), cash: true });

  // Por pagar con cuotas
  const debt = await mov(cat("debt", ""), 1200000, "Celular a cuotas", ago(15), null, { counterpart_name: "Tienda", due_date: ahead(2), installments: 6, installment_days: 30, cash: false });
  await http("POST", `/transactions/${debt.id}/payments`, t, { amount: 200000, currency: "USD", entity_id: banco.id, date: ago(4) });
  await mov(cat("debt", ""), 80000, "Suscripción anual", ago(6), null, { counterpart_name: "Streaming", due_date: ahead(20), cash: false });

  // Transferencia con comisión
  await http("POST", "/transfers", t, { from_entity_id: banco.id, to_entity_id: billetera.id, amount: 400000, fee: 4000, currency: "USD", date: ago(8) });

  // Gasto planificado
  await http("POST", "/planned", t, { name: "Compra del súper", category_id: exp("Alimentación"), currency: "USD", planned_date: ahead(3), items: items([["Arroz", 2, 12000], ["Aceite", 1, 14000], ["Pollo", 2, 42000], ["Café", 1]]) });

  console.log("Datos de prueba creados para", EMAIL);
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
