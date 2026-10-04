const pool = require("../config/database");

// Devuelve todo lo necesario para calcular saldos, deudas y estadísticas en el cliente.
exports.get = async (req, res, next) => {
  try {
    const uid = req.user.id;
    const [cats, ents, txs, trs, rates] = await Promise.all([
      pool.query(
        `SELECT c.id, c.code, c.name, c.type, c.icon, c.color, c.active
         FROM categories c
         LEFT JOIN category_order o ON o.category_id = c.id AND o.user_id = $1
         WHERE (c.user_id IS NULL OR c.user_id = $1)
           AND ((c.active = TRUE AND (c.code IS NOT NULL OR c.user_id = $1))
                OR c.id IN (SELECT category_id FROM transactions WHERE user_id = $1))
         ORDER BY COALESCE(o.position, 1000000), c.sort_order, c.id`,
        [uid],
      ),
      pool.query(
        `SELECT id, name, kind, currency, initial_usd::float AS initial_usd,
                initial_amount::float AS initial_amount,
                payment_type, payment_data, alert_usd::float AS alert_usd,
                include_in_balance, to_char(created_at,'YYYY-MM-DD') AS created,
                (EXTRACT(EPOCH FROM created_at) * 1000)::float AS ts
         FROM entities WHERE user_id = $1 ORDER BY COALESCE(sort_order, 1000000), id`,
        [uid],
      ),
      pool.query(
        `SELECT t.id, t.category_id, t.description, t.amount::float AS amount, t.currency,
                t.amount_usd::float AS amount_usd, t.amount_ves::float AS amount_ves,
                t.amount_binance::float AS amount_binance, to_char(t.date,'YYYY-MM-DD') AS date,
                to_char(t.due_date,'YYYY-MM-DD') AS due_date, t.counterpart_name, t.notes,
                t.entity_id, t.cash, t.status, t.receipt_name, t.installments, t.installment_days, t.recurring,
                (EXTRACT(EPOCH FROM t.created_at) * 1000)::float AS ts,
                (t.receipt_data IS NOT NULL) AS has_receipt,
                COALESCE((SELECT json_agg(json_build_object(
                    'id', p.id, 'amount', p.amount::float, 'currency', p.currency,
                    'amount_usd', p.amount_usd::float, 'amount_ves', p.amount_ves::float,
                    'amount_binance', p.amount_binance::float, 'rate', p.rate::float,
                    'date', to_char(p.date,'YYYY-MM-DD'), 'entity_id', p.entity_id, 'notes', p.notes,
                    'ts', (EXTRACT(EPOCH FROM p.created_at) * 1000)::float
                  ) ORDER BY p.date, p.id) FROM transaction_payments p WHERE p.transaction_id = t.id), '[]') AS payments,
                COALESCE((SELECT json_agg(json_build_object(
                    'id', i.id, 'name', i.name, 'amount_usd', i.amount_usd::float
                  ) ORDER BY i.id) FROM transaction_items i WHERE i.transaction_id = t.id), '[]') AS items
         FROM transactions t WHERE t.user_id = $1
         ORDER BY t.date DESC, t.id DESC`,
        [uid],
      ),
      pool.query(
        `SELECT id, from_entity_id, to_entity_id, amount_usd::float AS amount_usd,
                fee_usd::float AS fee_usd, currency, to_char(date,'YYYY-MM-DD') AS date,
                amount_ves::float AS amount_ves, amount_binance::float AS amount_binance,
                fee_ves::float AS fee_ves, fee_binance::float AS fee_binance,
                (EXTRACT(EPOCH FROM created_at) * 1000)::float AS ts
         FROM transfers WHERE user_id = $1 ORDER BY date DESC, id DESC`,
        [uid],
      ),
      pool.query(
        `SELECT usd_to_ves::float AS usd_to_ves, binance_to_ves::float AS binance_to_ves
         FROM exchange_rates WHERE user_id = $1`,
        [uid],
      ),
    ]);
    res.json({
      categories: cats.rows,
      entities: ents.rows,
      transactions: txs.rows,
      transfers: trs.rows,
      rates: rates.rows[0] || { usd_to_ves: 0, binance_to_ves: 0 },
    });
  } catch (err) {
    next(err);
  }
};

// Recibo adjunto (data URI) bajo demanda, para no inflar el ledger.
exports.receipt = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT receipt_name, receipt_data FROM transactions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!rows.length || !rows[0].receipt_data)
      return res.status(404).json({ error: "Sin recibo" });
    res.json({ name: rows[0].receipt_name, data: rows[0].receipt_data });
  } catch (err) {
    next(err);
  }
};
