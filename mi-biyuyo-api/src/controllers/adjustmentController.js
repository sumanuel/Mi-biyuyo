const pool = require("../config/database");
const { convertToAll } = require("../utils/currencyConverter");

const API_CCY = { usd: "USD", ves: "VES", usdt: "BINANCE" };

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
      `SELECT id, currency FROM entities WHERE id = $1 AND user_id = $2`,
      [entity_id, req.user.id],
    );
    if (!ents.length)
      return res.status(404).json({ error: "Entidad no encontrada" });

    const { rows: r } = await pool.query(
      `SELECT usd_to_ves, binance_to_ves FROM exchange_rates WHERE user_id = $1`,
      [req.user.id],
    );
    const rates = r[0] || { usd_to_ves: 0, binance_to_ves: 0 };
    // Los 3 valores con la tasa del día del ajuste (igual que movimientos y transferencias)
    const a = convertToAll(
      Math.abs(n),
      API_CCY[ents[0].currency] || "USD",
      rates,
    );
    const sg = n < 0 ? -1 : 1;
    const text = String(note || "").trim().slice(0, 255) || null;

    const { rows } = await pool.query(
      `INSERT INTO balance_adjustments
         (user_id, entity_id, amount, amount_usd, amount_ves, amount_binance, date, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, entity_id, amount::float AS amount, amount_usd::float AS amount_usd,
                 amount_ves::float AS amount_ves, amount_binance::float AS amount_binance,
                 to_char(date,'YYYY-MM-DD') AS date, note,
                 (EXTRACT(EPOCH FROM created_at) * 1000)::float AS ts`,
      [
        req.user.id,
        entity_id,
        Math.round(n * 10000) / 10000,
        sg * a.amount_usd,
        sg * a.amount_ves,
        sg * a.amount_binance,
        date || new Date().toISOString().slice(0, 10),
        text,
      ],
    );
    res.status(201).json(rows[0]);
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
