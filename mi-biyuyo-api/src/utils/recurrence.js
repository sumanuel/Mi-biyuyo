const { convertToAll } = require("./currencyConverter");

/**
 * Deudas recurrentes (por cobrar / por pagar que se repiten cada mes).
 * Cuando una deuda recurrente se salda, se crea la del mes siguiente: misma categoría, persona,
 * monto y cuotas, con el vencimiento (o la primera cuota) un mes después. Se crea sin mover dinero
 * de ninguna entidad (cash = false): el dinero se registra al cobrar o pagar.
 *
 * Solo se crea una vez por deuda (recurrence_source apunta a la que la originó), aunque se
 * borre y vuelva a registrar un abono.
 *
 * `db` es un pool o un cliente de pg. Devuelve { id, due_date } de la nueva deuda, o null.
 */
async function spawnNextRecurrence(db, userId, debtId) {
  const { rows } = await db.query(
    `SELECT t.*,
            to_char(COALESCE(t.due_date, t.date) + INTERVAL '1 month', 'YYYY-MM-DD') AS next_due
     FROM transactions t
     WHERE t.id = $1 AND t.user_id = $2 AND t.recurring = TRUE`,
    [debtId, userId],
  );
  if (!rows.length) return null;
  const src = rows[0];

  const { rows: already } = await db.query(
    `SELECT id FROM transactions WHERE recurrence_source = $1 LIMIT 1`,
    [src.id],
  );
  if (already.length) return null;

  // Valores con las tasas de hoy; si falta alguna tasa, se copian los de la deuda original
  let conv = {
    amount_usd: src.amount_usd,
    amount_ves: src.amount_ves,
    amount_binance: src.amount_binance,
  };
  try {
    const { rows: r } = await db.query(
      `SELECT usd_to_ves, binance_to_ves FROM exchange_rates WHERE user_id = $1`,
      [userId],
    );
    if (r.length) conv = convertToAll(parseFloat(src.amount), src.currency, r[0]);
  } catch (_) {
    /* se conservan los valores originales */
  }

  const { rows: created } = await db.query(
    `INSERT INTO transactions
       (user_id, category_id, amount, currency, amount_usd, amount_ves, amount_binance,
        description, date, counterpart_name, notes, entity_id, cash, due_date,
        installments, installment_days, recurring, recurrence_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,$9,$10,NULL,FALSE,$11,$12,$13,TRUE,$14)
     RETURNING id, to_char(due_date, 'YYYY-MM-DD') AS due_date`,
    [
      userId,
      src.category_id,
      src.amount,
      src.currency,
      conv.amount_usd,
      conv.amount_ves,
      conv.amount_binance,
      src.description,
      src.counterpart_name,
      src.notes,
      src.next_due,
      src.installments,
      src.installment_days,
      src.id,
    ],
  );
  return created[0];
}

module.exports = { spawnNextRecurrence };
