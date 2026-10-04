const pool = require("../config/database");

// Gastos planificados: plantillas reutilizables (nombre, categoría, fecha prevista opcional,
// monto estimado opcional e ítems con monto opcional). No son movimientos: no afectan saldos
// hasta que el usuario las registra desde el formulario de gasto.

const CURRENCIES = ["USD", "VES", "BINANCE"];

function fail(msg) {
  const err = new Error(msg);
  err.status = 422;
  return err;
}

const num = (v) => {
  const n = parseFloat(v);
  return n > 0 ? Math.round(n * 100) / 100 : null;
};

// Consulta común: el plan con sus ítems en orden
const SELECT = `
  SELECT p.id, p.name, p.category_id, to_char(p.planned_date, 'YYYY-MM-DD') AS planned_date,
         p.amount::float AS amount, p.currency, p.notes,
         COALESCE((SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'amount', i.amount::float)
                                   ORDER BY i.position, i.id)
                   FROM planned_expense_items i WHERE i.plan_id = p.id), '[]') AS items
  FROM planned_expenses p`;

exports.SELECT = SELECT;

async function clean(client, userId, body) {
  const name = String(body.name || "").trim();
  if (!name) throw fail("El nombre del plan es requerido");
  if (name.length > 120) throw fail("El nombre es demasiado largo");

  // La categoría debe ser un gasto visible para el usuario
  let categoryId = null;
  if (body.category_id) {
    const { rows } = await client.query(
      `SELECT id FROM categories
       WHERE id = $1 AND type = 'expense' AND (user_id = $2 OR user_id IS NULL)`,
      [body.category_id, userId],
    );
    if (!rows.length) throw fail("La categoría debe ser de gastos");
    categoryId = rows[0].id;
  }

  const date = body.planned_date ? String(body.planned_date).slice(0, 10) : null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail("Fecha inválida");

  const items = (Array.isArray(body.items) ? body.items : [])
    .slice(0, 100)
    .map((it) => ({
      name: String(it?.name || "").trim().slice(0, 100),
      amount: num(it?.amount),
    }))
    .filter((it) => it.name);

  const amount = num(body.amount);
  const hasMoney = amount !== null || items.some((it) => it.amount !== null);
  const currency = CURRENCIES.includes(body.currency) ? body.currency : null;
  if (hasMoney && !currency) throw fail("Elige la moneda de los montos");

  return {
    name,
    categoryId,
    date,
    amount,
    currency: hasMoney ? currency : null,
    notes: String(body.notes || "").trim() || null,
    items,
  };
}

async function saveItems(client, planId, items) {
  await client.query(`DELETE FROM planned_expense_items WHERE plan_id = $1`, [planId]);
  for (let i = 0; i < items.length; i++) {
    await client.query(
      `INSERT INTO planned_expense_items (plan_id, name, amount, position) VALUES ($1,$2,$3,$4)`,
      [planId, items[i].name, items[i].amount, i],
    );
  }
}

exports.create = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const p = await clean(client, req.user.id, req.body);
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO planned_expenses (user_id, name, category_id, planned_date, amount, currency, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user.id, p.name, p.categoryId, p.date, p.amount, p.currency, p.notes],
    );
    await saveItems(client, rows[0].id, p.items);
    await client.query("COMMIT");
    const { rows: full } = await pool.query(`${SELECT} WHERE p.id = $1`, [rows[0].id]);
    res.status(201).json(full[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

exports.update = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rows: own } = await client.query(
      `SELECT id FROM planned_expenses WHERE id = $1 AND user_id = $2`,
      [id, req.user.id],
    );
    if (!own.length) return res.status(404).json({ error: "Plan no encontrado" });
    const p = await clean(client, req.user.id, req.body);
    await client.query("BEGIN");
    await client.query(
      `UPDATE planned_expenses
       SET name = $1, category_id = $2, planned_date = $3, amount = $4, currency = $5,
           notes = $6, updated_at = NOW()
       WHERE id = $7`,
      [p.name, p.categoryId, p.date, p.amount, p.currency, p.notes, id],
    );
    await saveItems(client, id, p.items);
    await client.query("COMMIT");
    const { rows: full } = await pool.query(`${SELECT} WHERE p.id = $1`, [id]);
    res.json(full[0]);
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
      `DELETE FROM planned_expenses WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Plan no encontrado" });
    res.json({ message: "Plan eliminado" });
  } catch (err) {
    next(err);
  }
};
