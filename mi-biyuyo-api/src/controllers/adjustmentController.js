const pool = require("../config/database");
const { convertToAll } = require("../utils/currencyConverter");

const API_CCY = { usd: "USD", ves: "VES", usdt: "BINANCE" };

// Inserta un ajuste de saldo con la conexión o el pool `db`. `n` va con signo (+ suma, - resta)
// en la moneda de la entidad `ent` ({ id, currency }). Los 3 valores se guardan con la tasa del día.
async function insertAdjustment(db, userId, ent, n, date, note) {
  const { rows: r } = await db.query(
    `SELECT usd_to_ves, binance_to_ves FROM exchange_rates WHERE user_id = $1`,
    [userId],
  );
  const rates = r[0] || { usd_to_ves: 0, binance_to_ves: 0 };
  const a = convertToAll(Math.abs(n), API_CCY[ent.currency] || "USD", rates);
  const sg = n < 0 ? -1 : 1;
  const text = String(note || "").trim().slice(0, 255) || null;
  const { rows } = await db.query(
    `INSERT INTO balance_adjustments
       (user_id, entity_id, amount, amount_usd, amount_ves, amount_binance, date, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, entity_id, amount::float AS amount, amount_usd::float AS amount_usd,
               amount_ves::float AS amount_ves, amount_binance::float AS amount_binance,
               to_char(date,'YYYY-MM-DD') AS date, note,
               (EXTRACT(EPOCH FROM created_at) * 1000)::float AS ts`,
    [
      userId,
      ent.id,
      Math.round(n * 10000) / 10000,
      sg * a.amount_usd,
      sg * a.amount_ves,
      sg * a.amount_binance,
      date || new Date().toISOString().slice(0, 10),
      text,
    ],
  );
  return rows[0];
}
exports.insertAdjustment = insertAdjustment;

// Ajuste de saldo: `amount` con signo (+ suma, - resta) en la moneda de la entidad.
// No es un ingreso ni un gasto: solo corrige el saldo de esa entidad (no entra en estadísticas).
exports.create = async (req, res, next) => {
  try {
    const { entity_id, amount, date, note } = req.body;
    const n = parseFloat(amount);
    if (!entity_id || !Number.isFinite(n))
      return res.status(422).json({ error: "Faltan datos del ajuste" });
    if (Math.abs(n) < 0.0001)
      return res.status(422).json({ error: "El ajuste no puede ser cero" });
    if (Math.abs(n) > 1e11)
      return res.status(422).json({ error: "El monto es demasiado grande" });

    const { rows: ents } = await pool.query(
      `SELECT id, currency, archived_at FROM entities WHERE id = $1 AND user_id = $2`,
      [entity_id, req.user.id],
    );
    if (!ents.length)
      return res.status(404).json({ error: "Entidad no encontrada" });
    if (ents[0].archived_at)
      return res
        .status(409)
        .json({ error: "La entidad está archivada. Restáurala para ajustarla" });

    const row = await insertAdjustment(pool, req.user.id, ents[0], n, date, note);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

// Deshacer un ajuste: el saldo de la entidad vuelve a como estaba antes de él
exports.remove = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM balance_adjustments WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Ajuste no encontrado" });
    res.json({ message: "Ajuste eliminado" });
  } catch (err) {
    next(err);
  }
};
