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
    const { id: transactionId } = req.params;
    // Ownership check
    const { rows: txRows } = await pool.query(
      `SELECT id FROM transactions WHERE id = $1 AND user_id = $2`,
      [transactionId, req.user.id],
    );
    if (!txRows.length)
      return res.status(404).json({ error: "Transacción no encontrada" });

    const { rows } = await pool.query(
      `SELECT * FROM transaction_payments WHERE transaction_id = $1 ORDER BY date DESC, created_at DESC`,
      [transactionId],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { id: transactionId } = req.params;
    const { amount, currency, date, notes } = req.body;
    if (!amount || !currency)
      return res
        .status(422)
        .json({ error: "amount y currency son requeridos" });

    // Ownership check
    const { rows: txRows } = await pool.query(
      `SELECT id, amount_usd FROM transactions WHERE id = $1 AND user_id = $2`,
      [transactionId, req.user.id],
    );
    if (!txRows.length)
      return res.status(404).json({ error: "Transacción no encontrada" });

    const rates = await getUserRates(req.user.id);
    const converted = convertToAll(amount, currency, rates);

    const { rows } = await pool.query(
      `INSERT INTO transaction_payments (transaction_id, amount, currency, amount_usd, amount_ves, amount_binance, date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        transactionId,
        amount,
        currency,
        converted.amount_usd,
        converted.amount_ves,
        converted.amount_binance,
        date || new Date().toISOString().slice(0, 10),
        notes || null,
      ],
    );

    // Auto-mark as paid if remaining_usd <= 0
    const { rows: sumRows } = await pool.query(
      `SELECT t.amount_usd,
              COALESCE(SUM(tp.amount_usd),0) AS total_paid_usd
       FROM transactions t
       LEFT JOIN transaction_payments tp ON tp.transaction_id = t.id
       WHERE t.id = $1 GROUP BY t.amount_usd`,
      [transactionId],
    );
    if (
      sumRows.length &&
      parseFloat(sumRows[0].total_paid_usd) >= parseFloat(sumRows[0].amount_usd)
    ) {
      await pool.query(
        `UPDATE transactions SET status = 'paid', updated_at = NOW() WHERE id = $1`,
        [transactionId],
      );
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id: transactionId, paymentId } = req.params;
    // Ownership check via JOIN
    const { rows } = await pool.query(
      `DELETE FROM transaction_payments tp
       USING transactions t
       WHERE tp.id = $1 AND tp.transaction_id = $2 AND t.id = tp.transaction_id AND t.user_id = $3
       RETURNING tp.id`,
      [paymentId, transactionId, req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Abono no encontrado" });

    // Revert status to active if was paid
    await pool.query(
      `UPDATE transactions SET status = 'active', updated_at = NOW()
       WHERE id = $1 AND status = 'paid'`,
      [transactionId],
    );

    res.json({ message: "Abono eliminado" });
  } catch (err) {
    next(err);
  }
};
