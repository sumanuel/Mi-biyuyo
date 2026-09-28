const pool = require("../config/database");
const { convertToAll } = require("../utils/currencyConverter");

async function getUserRates(userId) {
  const { rows } = await pool.query(
    `SELECT usd_to_ves, binance_to_ves FROM exchange_rates WHERE user_id = $1`,
    [userId],
  );
  return rows[0] || { usd_to_ves: 0, binance_to_ves: 0 };
}

exports.list = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      type,
      category_id,
      status,
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = req.query;

    let where = "WHERE t.user_id = $1";
    const params = [userId];
    let idx = 2;

    if (type) {
      where += ` AND c.type = $${idx++}`;
      params.push(type);
    }
    if (category_id) {
      where += ` AND t.category_id = $${idx++}`;
      params.push(category_id);
    }
    if (status) {
      where += ` AND t.status = $${idx++}`;
      params.push(status);
    }
    if (date_from) {
      where += ` AND t.date >= $${idx++}`;
      params.push(date_from);
    }
    if (date_to) {
      where += ` AND t.date <= $${idx++}`;
      params.push(date_to);
    }

    const { rows } = await pool.query(
      `SELECT t.*, c.name AS category_name, c.type AS category_type,
              c.macro_type, c.icon AS category_icon, c.color AS category_color,
              COALESCE(SUM(tp.amount_usd), 0)     AS paid_usd,
              COALESCE(SUM(tp.amount_ves), 0)     AS paid_ves,
              COALESCE(SUM(tp.amount_binance), 0) AS paid_binance
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN transaction_payments tp ON tp.transaction_id = t.id
       ${where}
       GROUP BY t.id, c.name, c.type, c.macro_type, c.icon, c.color
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), parseInt(offset)],
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM transactions t LEFT JOIN categories c ON c.id = t.category_id ${where}`,
      params.slice(0, idx - 3),
    );

    res.json({ data: rows, total: parseInt(countRows[0].count) });
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, c.name AS category_name, c.type AS category_type,
              c.macro_type, c.icon AS category_icon, c.color AS category_color,
              COALESCE(SUM(tp.amount_usd), 0)     AS paid_usd,
              COALESCE(SUM(tp.amount_ves), 0)     AS paid_ves,
              COALESCE(SUM(tp.amount_binance), 0) AS paid_binance
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN transaction_payments tp ON tp.transaction_id = t.id
       WHERE t.id = $1 AND t.user_id = $2
       GROUP BY t.id, c.name, c.type, c.macro_type, c.icon, c.color`,
      [req.params.id, req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Transacción no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      category_id,
      amount,
      currency,
      description,
      date,
      counterpart_name,
      notes,
    } = req.body;
    if (!amount || !currency)
      return res
        .status(422)
        .json({ error: "amount y currency son requeridos" });

    const rates = await getUserRates(req.user.id);
    const converted = convertToAll(amount, currency, rates);

    const { rows } = await pool.query(
      `INSERT INTO transactions
         (user_id, category_id, amount, currency, amount_usd, amount_ves, amount_binance,
          description, date, counterpart_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        req.user.id,
        category_id || null,
        amount,
        currency,
        converted.amount_usd,
        converted.amount_ves,
        converted.amount_binance,
        description || null,
        date || new Date().toISOString().slice(0, 10),
        counterpart_name || null,
        notes || null,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: existing } = await pool.query(
      `SELECT id FROM transactions WHERE id = $1 AND user_id = $2`,
      [id, req.user.id],
    );
    if (!existing.length)
      return res.status(404).json({ error: "Transacción no encontrada" });

    const {
      category_id,
      amount,
      currency,
      description,
      date,
      counterpart_name,
      status,
      notes,
    } = req.body;
    let converted = {};
    if (amount && currency) {
      const rates = await getUserRates(req.user.id);
      converted = convertToAll(amount, currency, rates);
    }

    const { rows } = await pool.query(
      `UPDATE transactions SET
         category_id      = COALESCE($1, category_id),
         amount           = COALESCE($2, amount),
         currency         = COALESCE($3, currency),
         amount_usd       = COALESCE($4, amount_usd),
         amount_ves       = COALESCE($5, amount_ves),
         amount_binance   = COALESCE($6, amount_binance),
         description      = COALESCE($7, description),
         date             = COALESCE($8, date),
         counterpart_name = COALESCE($9, counterpart_name),
         status           = COALESCE($10, status),
         notes            = COALESCE($11, notes),
         updated_at       = NOW()
       WHERE id = $12 RETURNING *`,
      [
        category_id ?? null,
        amount ?? null,
        currency ?? null,
        converted.amount_usd ?? null,
        converted.amount_ves ?? null,
        converted.amount_binance ?? null,
        description ?? null,
        date ?? null,
        counterpart_name ?? null,
        status ?? null,
        notes ?? null,
        id,
      ],
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Transacción no encontrada" });
    res.json({ message: "Transacción eliminada" });
  } catch (err) {
    next(err);
  }
};
