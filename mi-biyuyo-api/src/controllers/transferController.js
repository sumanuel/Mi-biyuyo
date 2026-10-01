const pool = require("../config/database");
const { convertFor } = require("../utils/currencyConverter");
const { getUserCtx } = require("../utils/userContext");

exports.create = async (req, res, next) => {
  try {
    const { from_entity_id, to_entity_id, amount, fee, currency, date } =
      req.body;
    if (!from_entity_id || !to_entity_id || !amount || !currency)
      return res
        .status(422)
        .json({ error: "Faltan datos de la transferencia" });
    if (String(from_entity_id) === String(to_entity_id))
      return res
        .status(422)
        .json({ error: "Origen y destino deben ser distintos" });

    const { rows: ents } = await pool.query(
      `SELECT id FROM entities WHERE user_id = $1 AND id = ANY($2::int[])`,
      [req.user.id, [from_entity_id, to_entity_id]],
    );
    if (ents.length !== 2)
      return res.status(404).json({ error: "Entidad no encontrada" });

    const ctx = await getUserCtx(req.user.id);
    // Se guardan los valores con la tasa del día de la transferencia (sin tasas en modo single)
    const a = convertFor(amount, currency, ctx);
    const f = parseFloat(fee) > 0 ? convertFor(fee, currency, ctx) : null;

    const { rows } = await pool.query(
      `INSERT INTO transfers
         (user_id, from_entity_id, to_entity_id, amount_usd, fee_usd, currency, date,
          amount_ves, amount_binance, fee_ves, fee_binance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, from_entity_id, to_entity_id, amount_usd::float AS amount_usd,
                 fee_usd::float AS fee_usd, currency, to_char(date,'YYYY-MM-DD') AS date`,
      [
        req.user.id,
        from_entity_id,
        to_entity_id,
        a.amount_usd,
        f ? f.amount_usd : 0,
        currency,
        date || new Date().toISOString().slice(0, 10),
        a.amount_ves,
        a.amount_binance,
        f ? f.amount_ves : 0,
        f ? f.amount_binance : 0,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM transfers WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Transferencia no encontrada" });
    res.json({ message: "Transferencia eliminada" });
  } catch (err) {
    next(err);
  }
};
