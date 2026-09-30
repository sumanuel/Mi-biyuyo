// Datos de demostración = los del prototipo (Mi Biyuyo · Prototipo.html).
// Uso:  node database/seed_demo.js [correo]      (por defecto demo@mibiyuyo.test / Demo1234!)
// Crea el usuario si no existe y REEMPLAZA sus entidades, movimientos y transferencias.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../src/config/database");

const EMAIL = process.argv[2] || "demo@mibiyuyo.test";
const PASSWORD = "Demo1234!";
const RATE = 150;
const RATE_B = 165;
// Unidades por 1 USD: VES = tasa BCV; USDT (Binance) = BCV / Binance (1 USDT = RATE_B VES)
const FACT = { usd: 1, bcv: RATE, bin: RATE / RATE_B };
const API_CCY = { usd: "USD", bcv: "VES", bin: "BINANCE" };

const ENTS = [
  { key: "cash", name: "Efectivo", kind: "efectivo", ccy: "usd", init: 260, pt: "none", pd: [], alert: 50 },
  { key: "banesco", name: "Banesco", kind: "banco", ccy: "ves", init: 120, pt: "pm", pd: ["Banesco (0134)", "0412-555-0182", "V-12.345.678"] },
  { key: "mercantil", name: "Mercantil", kind: "banco", ccy: "ves", init: 180, pt: "acct", pd: ["0105-0123-45-1234567890", "Jesús Prada", "V-12.345.678"] },
  { key: "paypal", name: "PayPal", kind: "digital", ccy: "usd", init: 120, pt: "email", pd: ["jesus.prada@correo.com", "Jesús Prada"], alert: 100 },
  { key: "binance", name: "Binance", kind: "digital", ccy: "usd", init: 30, pt: "id", pd: ["123456789", "Binance Pay"] },
];

// [id, código de categoría, título, días atrás, monto USD, moneda, método, persona, vence en (días), abonos, ¿movió dinero?]
const MOVES = [
  ["s1", "i-sueldo", "Sueldo quincenal", 2, 250, "usd", "Transferencia"],
  ["s2", "i-bono", "Bono de alimentación", 6, 40, "bcv", "Pago Móvil"],
  ["s3", "i-free", "Diseño de logo", 9, 120, "usd", "Efectivo"],
  ["s4", "i-sueldo", "Sueldo quincenal", 17, 250, "usd", "Transferencia"],
  ["s5", "i-inversion", "Intereses", 24, 18, "usd", "Transferencia"],
  ["s6", "i-remesa", "Remesa familiar", 33, 100, "bin", "Transferencia"],
  ["s7", "i-sueldo", "Sueldo quincenal", 47, 250, "usd", "Transferencia"],
  ["s8", "i-free", "Traducción", 55, 90, "usd", "Efectivo"],
  ["s9", "i-sueldo", "Sueldo quincenal", 62, 250, "usd", "Transferencia"],
  ["s10", "i-bono", "Bono vacacional", 70, 60, "bcv", "Transferencia"],
  ["g1", "g-food", "Mercado", 0, 22.4, "bin", "Tarjeta"],
  ["g2", "g-car", "Gasolina", 1, 15, "usd", "Efectivo"],
  ["g3", "g-food", "Café y desayuno", 1, 4.2, "bcv", "Pago Móvil"],
  ["g4", "g-serv", "Internet", 3, 18, "usd", "Transferencia"],
  ["g5", "g-school", "Mensualidad", 5, 60, "usd", "Transferencia"],
  ["g6", "g-health", "Farmacia", 7, 12.5, "bcv", "Pago Móvil"],
  ["g7", "g-food", "Mercado", 8, 38, "bin", "Tarjeta"],
  ["g8", "g-transp", "Pasajes", 10, 6, "bcv", "Efectivo"],
  ["g9", "g-ocio", "Cine", 12, 9, "usd", "Efectivo"],
  ["g10", "g-food", "Restaurante", 15, 27, "bin", "Tarjeta"],
  ["g11", "g-car", "Mantenimiento", 19, 45, "usd", "Efectivo"],
  ["g12", "g-ropa", "Zapatos", 22, 35, "bin", "Tarjeta"],
  ["g13", "g-food", "Mercado", 26, 41, "bin", "Tarjeta"],
  ["g14", "g-serv", "Electricidad", 28, 12, "bcv", "Pago Móvil"],
  ["g15", "g-school", "Útiles escolares", 31, 28, "usd", "Efectivo"],
  ["g16", "g-health", "Consulta médica", 38, 30, "usd", "Efectivo"],
  ["g17", "g-food", "Mercado", 44, 39, "bin", "Tarjeta"],
  ["g18", "g-home", "Alquiler", 50, 120, "usd", "Transferencia"],
  ["g19", "g-pets", "Veterinario", 58, 20, "usd", "Efectivo"],
  ["g20", "g-food", "Mercado", 66, 44, "bin", "Tarjeta"],
  ["g21", "g-car", "Repuestos", 75, 55, "usd", "Efectivo"],
  ["c1", "c-fam", "Préstamo para el carro", 12, 30, "usd", null, "Carlos", 5, [{ d: 3, usd: 10, ccy: "usd", method: "Efectivo" }]],
  ["c2", "c-amigo", "Préstamo", 20, 25, "usd", null, "Luis", -3],
  ["c3", "c-adelanto", "Adelanto de sueldo", 4, 13.6, "bcv", null, "Ana", 12],
  ["p1", "p-tarjeta", "Saldo de la tarjeta", 25, 120, "usd", null, "Banco", 2, [{ d: 15, usd: 40, ccy: "bcv", method: "Pago Móvil" }, { d: 4, usd: 20, ccy: "usd", method: "Transferencia" }], false],
  ["p2", "p-fam", "Préstamo de mamá", 30, 50, "usd", null, "Mamá", null],
];
const METHOD_ENT = { Efectivo: "cash", "Pago Móvil": "banesco", Transferencia: "mercantil", Tarjeta: "banesco", Zelle: "paypal" };
const SEED_ENT = { c1: "cash", c2: "cash", c3: "banesco", p2: "mercantil", s1: "banesco", s4: "banesco", s7: "banesco", s9: "banesco", s6: "binance", s5: "binance" };
const ITEMS = {
  g1: [["Queso"], ["Jamón"], ["Vino"], ["Aceitunas"]],
  g7: [["Queso", 12], ["Jamón", 9], ["Vino", 14]],
  g10: [["Pizza"], ["Refresco"]],
  g13: [["Queso", 11], ["Vino", 16], ["Pan", 5]],
  g17: [["Queso", 10], ["Jamón", 8], ["Vino", 15], ["Huevos", 6]],
  g20: [["Vino", 18], ["Queso", 12]],
};
// PNG gris de 1x1 como recibo de ejemplo
const RECEIPT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const dateAgo = (d) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let { rows: u } = await client.query(`SELECT id FROM users WHERE email = $1`, [EMAIL]);
    if (!u.length) {
      const hash = await bcrypt.hash(PASSWORD, 10);
      ({ rows: u } = await client.query(
        `INSERT INTO users (name, email, password_hash) VALUES ('Jesús', $1, $2) RETURNING id`,
        [EMAIL, hash],
      ));
      console.log(`Usuario creado: ${EMAIL} / ${PASSWORD}`);
    }
    const uid = u[0].id;

    await client.query(`DELETE FROM transfers WHERE user_id = $1`, [uid]);
    await client.query(`DELETE FROM transactions WHERE user_id = $1`, [uid]);
    await client.query(`DELETE FROM entities WHERE user_id = $1`, [uid]);
    await client.query(
      `INSERT INTO exchange_rates (user_id, usd_to_ves, binance_to_ves, source)
       VALUES ($1,$2,$3,'manual')
       ON CONFLICT (user_id) DO UPDATE SET usd_to_ves = $2, binance_to_ves = $3, source = 'manual'`,
      [uid, RATE, RATE_B],
    );

    const entId = {};
    for (const e of ENTS) {
      const { rows } = await client.query(
        `INSERT INTO entities (user_id, name, kind, currency, initial_usd, payment_type, payment_data, alert_usd)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [uid, e.name, e.kind, e.ccy, e.init, e.pt, JSON.stringify(e.pd), e.alert ?? null],
      );
      entId[e.key] = rows[0].id;
    }

    const { rows: cats } = await client.query(
      `SELECT id, code FROM categories WHERE user_id IS NULL AND code IS NOT NULL`,
    );
    const catId = {};
    cats.forEach((c) => (catId[c.code] = c.id));

    for (const m of MOVES) {
      const [id, code, title, d, usd, ccy, method, person, dueIn, pays, cash] = m;
      const isDebt = id[0] === "c" || id[0] === "p";
      const hasCash = cash !== false;
      const ent = SEED_ENT[id] || (method ? METHOD_ENT[method] : null);
      const receipt = id === "g7";
      const { rows } = await client.query(
        `INSERT INTO transactions
           (user_id, category_id, amount, currency, amount_usd, amount_ves, amount_binance,
            description, date, counterpart_name, entity_id, cash, due_date, receipt_name, receipt_data, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active') RETURNING id`,
        [
          uid,
          catId[code],
          Math.round(usd * FACT[ccy] * 100) / 100,
          API_CCY[ccy],
          usd,
          usd * RATE,
          usd * FACT.bin,
          title,
          dateAgo(d),
          person || null,
          isDebt && !hasCash ? null : ent ? entId[ent] : null,
          hasCash,
          dueIn === undefined || dueIn === null ? null : (() => {
            const t = new Date();
            t.setDate(t.getDate() + dueIn);
            return dateAgo(-dueIn);
          })(),
          receipt ? "Recibo_mercado.jpg" : null,
          receipt ? RECEIPT_PNG : null,
        ],
      );
      const tid = rows[0].id;
      for (const [name, amt] of ITEMS[id] || []) {
        await client.query(
          `INSERT INTO transaction_items (transaction_id, name, amount_usd) VALUES ($1,$2,$3)`,
          [tid, name, amt ?? null],
        );
      }
      for (const p of pays || []) {
        await client.query(
          `INSERT INTO transaction_payments
             (transaction_id, amount, currency, amount_usd, amount_ves, amount_binance, date, notes, entity_id, rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            tid,
            Math.round(p.usd * FACT[p.ccy] * 100) / 100,
            API_CCY[p.ccy],
            p.usd,
            p.usd * RATE,
            p.usd * FACT.bin,
            dateAgo(p.d),
            p.method,
            entId[METHOD_ENT[p.method] || "cash"],
            FACT[p.ccy],
          ],
        );
      }
    }

    await client.query(
      `INSERT INTO transfers (user_id, from_entity_id, to_entity_id, amount_usd, fee_usd, currency, date)
       VALUES ($1,$2,$3,20,0.5,'USD',$4)`,
      [uid, entId.paypal, entId.binance, dateAgo(11)],
    );

    await client.query("COMMIT");
    console.log(`✅ Datos de demostración cargados para ${EMAIL}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    pool.end();
  }
}

run();
