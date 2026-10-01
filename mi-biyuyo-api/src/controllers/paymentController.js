const pool = require("../config/database");
const { convertFor, factorOf } = require("../utils/currencyConverter");
const { getUserCtx } = require("../utils/userContext");

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
    const { amount, currency, date, notes, entity_id } = req.body;
    if (!amount || !currency)
      return res
        .status(422)
        .json({ error: "amount y currency son requeridos" });

    // Ownership check + saldo pendiente EN LA MONEDA DE LA DEUDA:
    // cada abono descuenta su valor del día (guardado al registrarse) convertido a esa moneda.
    const { rows: txRows } = await pool.query(
      `SELECT t.id, t.amount, t.currency,
              COALESCE((SELECT SUM(CASE t.currency
                          WHEN 'USD' THEN p.amount_usd
                          WHEN 'VES' THEN p.amount_ves
                          ELSE p.amount_binance END)
                        FROM transaction_payments p WHERE p.transaction_id = t.id), 0) AS paid
       FROM transactions t WHERE t.id = $1 AND t.user_id = $2`,
      [transactionId, req.user.id],
    );
    if (!txRows.length)
      return res.status(404).json({ error: "Transacción no encontrada" });

    if (entity_id) {
      const { rows: en } = await pool.query(
        `SELECT id FROM entities WHERE id = $1 AND user_id = $2`,
        [entity_id, req.user.id],
      );
      if (!en.length)
        return res.status(404).json({ error: "Entidad no encontrada" });
    }

    const ctx = await getUserCtx(req.user.id);
    const converted = convertFor(amount, currency, ctx);
    const col = {
      USD: "amount_usd",
      VES: "amount_ves",
      BINANCE: "amount_binance",
    }[txRows[0].currency];
    const pending = parseFloat(txRows[0].amount) - parseFloat(txRows[0].paid);
    const payNative = converted[col];
    const tol = txRows[0].currency === "BINANCE" ? 0.005 : 0.01;
    if (payNative > pending + tol)
      return res
        .status(422)
        .json({ error: "El monto supera el saldo pendiente" });

    const { rows } = await pool.query(
      `INSERT INTO transaction_payments
         (transaction_id, amount, currency, amount_usd, amount_ves, amount_binance, date, notes, entity_id, rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        transactionId,
        amount,
        currency,
        converted.amount_usd,
        converted.amount_ves,
        converted.amount_binance,
        date || new Date().toISOString().slice(0, 10),
        notes || null,
        entity_id || null,
        ctx.mode === "single" ? 1 : factorOf(currency, ctx.rates),
      ],
    );

    if (pending - payNative <= tol) {
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
