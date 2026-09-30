const pool = require("../config/database");
const { convertToAll, toUsd } = require("../utils/currencyConverter");

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

async function assertEntity(userId, entityId) {
  if (!entityId) return null;
  const { rows } = await pool.query(
    `SELECT id FROM entities WHERE id = $1 AND user_id = $2`,
    [entityId, userId],
  );
  if (!rows.length) {
    const err = new Error("Entidad no encontrada");
    err.status = 404;
    throw err;
  }
  return entityId;
}

async function replaceItems(client, transactionId, items, currency, rates) {
  await client.query(
    `DELETE FROM transaction_items WHERE transaction_id = $1`,
    [transactionId],
  );
  for (const it of items || []) {
    const name = String(it.name || "").trim();
    if (!name) continue;
    const amt = parseFloat(it.amount);
    await client.query(
      `INSERT INTO transaction_items (transaction_id, name, amount_usd) VALUES ($1,$2,$3)`,
      [transactionId, name, amt > 0 ? toUsd(amt, currency, rates) : null],
    );
  }
}

exports.create = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      category_id,
      amount,
      currency,
      description,
      date,
      counterpart_name,
      notes,
      entity_id,
      cash,
      due_date,
      items,
      receipt_name,
      receipt_data,
    } = req.body;
    if (!amount || !currency)
      return res
        .status(422)
        .json({ error: "amount y currency son requeridos" });

    const rates = await getUserRates(req.user.id);
    const converted = convertToAll(amount, currency, rates);
    await assertEntity(req.user.id, entity_id);

    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO transactions
         (user_id, category_id, amount, currency, amount_usd, amount_ves, amount_binance,
          description, date, counterpart_name, notes, entity_id, cash, due_date,
          receipt_name, receipt_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
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
        entity_id || null,
        cash === false ? false : true,
        due_date || null,
        receipt_name || null,
        receipt_data || null,
      ],
    );
    await replaceItems(client, rows[0].id, items, currency, rates);
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

/**
 * Tasas con las que se registró el movimiento, deducidas de sus valores guardados.
 * Si alguna no existía en ese momento, se usa la tasa actual de esa moneda.
 */
function originalRates(row, current) {
  const usd = parseFloat(row.amount_usd) || 0;
  const ves = parseFloat(row.amount_ves) || 0;
  const bin = parseFloat(row.amount_binance) || 0;
  const usdToVes = usd > 0 && ves > 0 ? ves / usd : current.usd_to_ves;
  const binFactor = usd > 0 && bin > 0 ? bin / usd : 0; // USDT por 1 USD
  const binToVes =
    binFactor > 0 && parseFloat(usdToVes) > 0
      ? parseFloat(usdToVes) / binFactor
      : current.binance_to_ves;
  return { usd_to_ves: usdToVes, binance_to_ves: binToVes };
}

/** Edita un movimiento conservando las tasas del día en que se registró. */
exports.update = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rows: existing } = await client.query(
      `SELECT t.*, c.type AS category_type,
              COALESCE((SELECT SUM(CASE t.currency
                          WHEN 'USD' THEN p.amount_usd
                          WHEN 'VES' THEN p.amount_ves
                          ELSE p.amount_binance END)
                        FROM transaction_payments p WHERE p.transaction_id = t.id), 0) AS paid,
              (SELECT COUNT(*) FROM transaction_payments p WHERE p.transaction_id = t.id) AS pay_count
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, req.user.id],
    );
    if (!existing.length)
      return res.status(404).json({ error: "Transacción no encontrada" });
    const cur = existing[0];
    const has = (k) => Object.prototype.hasOwnProperty.call(req.body, k);
    const b = req.body;

    // Categoría: debe ser del mismo tipo (ingreso, gasto, por cobrar o por pagar)
    let categoryId = cur.category_id;
    if (has("category_id") && b.category_id && b.category_id !== categoryId) {
      const { rows: cat } = await client.query(
        `SELECT id, type FROM categories WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
        [b.category_id, req.user.id],
      );
      if (!cat.length)
        return res.status(404).json({ error: "Categoría no encontrada" });
      if (cur.category_type && cat[0].type !== cur.category_type)
        return res
          .status(422)
          .json({ error: "La categoría debe ser del mismo tipo" });
      categoryId = cat[0].id;
    }

    const isDebt =
      cur.category_type === "cobrar" || cur.category_type === "pagar";
    const amount = has("amount")
      ? parseFloat(b.amount)
      : parseFloat(cur.amount);
    const currency = has("currency") ? b.currency : cur.currency;
    if (!(amount > 0))
      return res.status(422).json({ error: "El monto debe ser mayor a 0" });

    const hasPays = parseInt(cur.pay_count) > 0;
    if (isDebt && hasPays && currency !== cur.currency)
      return res.status(422).json({
        error: "No se puede cambiar la moneda de una deuda que ya tiene abonos",
      });
    const tol = currency === "BINANCE" ? 0.005 : 0.01;
    const paid = parseFloat(cur.paid);
    if (isDebt && amount < paid - tol)
      return res
        .status(422)
        .json({ error: "El monto no puede ser menor a lo ya abonado" });

    // Conversión con las tasas originales del movimiento
    const current = await getUserRates(req.user.id);
    const rates = originalRates(cur, current);
    // Monto sin cambios (la columna guarda 2 decimales): se conservan los valores exactos ya guardados
    const same =
      currency === cur.currency &&
      Math.abs(amount - parseFloat(cur.amount)) < 0.005;
    const converted = same
      ? {
          amount_usd: cur.amount_usd,
          amount_ves: cur.amount_ves,
          amount_binance: cur.amount_binance,
        }
      : convertToAll(amount, currency, rates);

    const entityId = has("entity_id")
      ? await assertEntity(req.user.id, b.entity_id)
      : cur.entity_id;
    const value = (k, fallback) => (has(k) ? b[k] || null : fallback);
    const status = isDebt
      ? parseFloat(amount) - paid <= tol
        ? "paid"
        : "active"
      : cur.status;

    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE transactions SET
         category_id = $1, amount = $2, currency = $3,
         amount_usd = $4, amount_ves = $5, amount_binance = $6,
         description = $7, date = $8, counterpart_name = $9, notes = $10,
         entity_id = $11, cash = $12, due_date = $13, status = $14,
         receipt_name = $15, receipt_data = $16, updated_at = NOW()
       WHERE id = $17 RETURNING *`,
      [
        categoryId,
        amount,
        currency,
        converted.amount_usd,
        converted.amount_ves,
        converted.amount_binance,
        value("description", cur.description),
        value("date", cur.date),
        value("counterpart_name", cur.counterpart_name),
        value("notes", cur.notes),
        entityId,
        has("cash") ? b.cash !== false : cur.cash,
        value("due_date", cur.due_date),
        status,
        has("receipt_name") ? b.receipt_name || null : cur.receipt_name,
        has("receipt_data") ? b.receipt_data || null : cur.receipt_data,
        id,
      ],
    );
    if (has("items")) await replaceItems(client, id, b.items, currency, rates);
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
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
