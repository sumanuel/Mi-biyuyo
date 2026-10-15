const pool = require("../config/database");

// Returns parent categories with nested children for this user + system defaults
exports.list = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT c.*,
              (c.user_id IS NULL) AS is_system
       FROM categories c
       WHERE (c.user_id IS NULL OR c.user_id = $1)
         AND c.active = TRUE
       ORDER BY c.sort_order, c.name`,
      [userId],
    );

    // Build hierarchy
    const parents = rows.filter((r) => !r.parent_id);
    const children = rows.filter((r) => r.parent_id);
    const result = parents.map((p) => ({
      ...p,
      children: children.filter((c) => c.parent_id === p.id),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── Categorías propias del usuario ──
// Las categorías predeterminadas (user_id NULL) son de todos: solo se pueden ocultar o mostrar.
const TYPES = ["income", "expense", "loan_given", "debt"];
const MAX_PER_TYPE = 40;
const ICON_RE = /^[a-zA-Z][a-zA-Z0-9]{0,29}$/;

function fail(status, msg, extra) {
  const err = new Error(msg);
  err.status = status;
  if (extra) Object.assign(err, { extra });
  return err;
}

const send = (res, err, next) =>
  err.status
    ? res.status(err.status).json({ error: err.message, ...(err.extra || {}) })
    : next(err);

function cleanName(v) {
  const name = String(v ?? "").trim().replace(/\s+/g, " ");
  if (!name) throw fail(422, "El nombre es requerido");
  if (name.length > 40) throw fail(422, "El nombre no puede pasar de 40 caracteres");
  return name;
}

function cleanIcon(v) {
  const icon = String(v ?? "").trim();
  if (!ICON_RE.test(icon)) throw fail(422, "Icono inválido");
  return icon;
}

// ¿Ya hay una categoría visible para el usuario con ese nombre en ese tipo?
async function nameTaken(db, userId, type, name, exceptId = null) {
  const { rows } = await db.query(
    `SELECT 1 FROM categories
     WHERE type = $1 AND lower(name) = lower($2) AND active = TRUE
       AND (user_id IS NULL OR user_id = $3) AND id <> COALESCE($4, -1)
     LIMIT 1`,
    [type, name, userId, exceptId],
  );
  return rows.length > 0;
}

// Categoría propia (o error 404 / 403)
async function ownCategory(db, userId, id) {
  const { rows } = await db.query(
    `SELECT id, user_id, type, name FROM categories WHERE id = $1`,
    [id],
  );
  if (!rows.length) throw fail(404, "Categoría no encontrada");
  if (rows[0].user_id === null)
    throw fail(403, "Las categorías predeterminadas no se pueden modificar ni eliminar; puedes ocultarlas");
  if (rows[0].user_id !== userId) throw fail(403, "Sin permiso");
  return rows[0];
}

exports.create = async (req, res, next) => {
  try {
    const type = String(req.body.type || "");
    if (!TYPES.includes(type)) throw fail(422, "Tipo de categoría inválido");
    const name = cleanName(req.body.name);
    const icon = cleanIcon(req.body.icon || "more");

    const { rows: cnt } = await pool.query(
      `SELECT count(*)::int n FROM categories WHERE user_id = $1 AND type = $2 AND active = TRUE`,
      [req.user.id, type],
    );
    if (cnt[0].n >= MAX_PER_TYPE)
      throw fail(422, `Llegaste al máximo de ${MAX_PER_TYPE} categorías propias en este tipo`);
    if (await nameTaken(pool, req.user.id, type, name))
      throw fail(409, "Ya existe una categoría con ese nombre");

    const { rows } = await pool.query(
      `INSERT INTO categories (user_id, name, type, icon, color, is_default, sort_order, active)
       VALUES ($1, $2, $3, $4, '#1F7A59', FALSE, 999, TRUE)
       RETURNING id, name, type, icon`,
      [req.user.id, name, type, icon],
    );
    if (req.body.hidden === true)
      await pool.query(
        `INSERT INTO category_hidden (user_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.user.id, rows[0].id],
      );
    res.status(201).json({ ...rows[0], own: true, hidden: req.body.hidden === true });
  } catch (err) {
    send(res, err, next);
  }
};

exports.update = async (req, res, next) => {
  try {
    const cur = await ownCategory(pool, req.user.id, req.params.id);
    const has = (k) => Object.prototype.hasOwnProperty.call(req.body, k);
    // El tipo no se puede cambiar: sus movimientos dejarían de tener sentido
    if (has("type") && req.body.type !== cur.type)
      throw fail(422, "No se puede cambiar el tipo de una categoría");
    const name = has("name") ? cleanName(req.body.name) : cur.name;
    const icon = has("icon") ? cleanIcon(req.body.icon) : null;
    if (name.toLowerCase() !== cur.name.toLowerCase() &&
        (await nameTaken(pool, req.user.id, cur.type, name, cur.id)))
      throw fail(409, "Ya existe una categoría con ese nombre");

    const { rows } = await pool.query(
      `UPDATE categories SET name = $1, icon = COALESCE($2, icon) WHERE id = $3
       RETURNING id, name, type, icon`,
      [name, icon, cur.id],
    );
    res.json({ ...rows[0], own: true });
  } catch (err) {
    send(res, err, next);
  }
};

// Oculta o muestra una categoría (propia o predeterminada) en «Nuevo movimiento»
exports.setVisibility = async (req, res, next) => {
  try {
    if (typeof req.body.hidden !== "boolean")
      throw fail(422, "hidden debe ser verdadero o falso");
    const { rows } = await pool.query(
      `SELECT id FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)`,
      [req.params.id, req.user.id],
    );
    if (!rows.length) throw fail(404, "Categoría no encontrada");
    if (req.body.hidden)
      await pool.query(
        `INSERT INTO category_hidden (user_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.user.id, rows[0].id],
      );
    else
      await pool.query(
        `DELETE FROM category_hidden WHERE user_id = $1 AND category_id = $2`,
        [req.user.id, rows[0].id],
      );
    res.json({ id: rows[0].id, hidden: req.body.hidden });
  } catch (err) {
    send(res, err, next);
  }
};

// Elimina una categoría propia. Si tiene movimientos hay que indicar a cuál otra pasarlos
// (?reassign_to=ID, del mismo tipo); sin eso responde 409 con la cantidad de movimientos.
exports.remove = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const cur = await ownCategory(client, req.user.id, req.params.id);
    const { rows: cnt } = await client.query(
      `SELECT count(*)::int n FROM transactions WHERE category_id = $1 AND user_id = $2`,
      [cur.id, req.user.id],
    );
    const movements = cnt[0].n;
    const target = req.query.reassign_to ?? req.body?.reassign_to;

    if (movements > 0 && !target)
      throw fail(409, "Esta categoría tiene movimientos: elige a cuál otra pasarlos", {
        code: "HAS_MOVEMENTS",
        movements,
      });

    let reassigned = 0;
    await client.query("BEGIN");
    if (target) {
      const { rows: t } = await client.query(
        `SELECT id, type FROM categories
         WHERE id = $1 AND active = TRUE AND (user_id IS NULL OR user_id = $2)`,
        [target, req.user.id],
      );
      if (!t.length) throw fail(404, "La categoría de destino no existe");
      if (t[0].id === cur.id) throw fail(422, "Elige una categoría distinta");
      if (t[0].type !== cur.type)
        throw fail(422, "La categoría de destino debe ser del mismo tipo");
      const r = await client.query(
        `UPDATE transactions SET category_id = $1 WHERE category_id = $2 AND user_id = $3`,
        [t[0].id, cur.id, req.user.id],
      );
      reassigned = r.rowCount;
      // Los gastos planificados que la usaban pasan a la categoría de destino
      await client.query(
        `UPDATE planned_expenses SET category_id = $1 WHERE category_id = $2 AND user_id = $3`,
        [t[0].id, cur.id, req.user.id],
      );
    }
    // category_order y category_hidden se borran en cascada
    await client.query(`DELETE FROM categories WHERE id = $1 AND user_id = $2`, [cur.id, req.user.id]);
    await client.query("COMMIT");
    res.json({ message: "Categoría eliminada", reassigned });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    send(res, err, next);
  } finally {
    client.release();
  }
};

// Guarda el orden que el usuario eligió para sus categorías (lista de ids, de la primera a la última).
exports.reorder = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const ids = [...new Set((req.body.ids || []).map(Number))].filter((n) =>
      Number.isInteger(n),
    );
    if (!ids.length || ids.length > 300)
      return res.status(422).json({ error: "Lista de categorías inválida" });

    // Solo categorías que el usuario puede ver (del sistema o suyas)
    const { rows } = await client.query(
      `SELECT id FROM categories WHERE id = ANY($1::int[]) AND (user_id IS NULL OR user_id = $2)`,
      [ids, req.user.id],
    );
    const valid = new Set(rows.map((r) => r.id));
    const list = ids.filter((id) => valid.has(id));

    await client.query("BEGIN");
    await client.query(
      `DELETE FROM category_order WHERE user_id = $1 AND category_id = ANY($2::int[])`,
      [req.user.id, list],
    );
    await client.query(
      `INSERT INTO category_order (user_id, category_id, position)
       SELECT $1, x.id, x.pos FROM unnest($2::int[], $3::int[]) AS x(id, pos)`,
      [req.user.id, list, list.map((_, i) => i)],
    );
    await client.query("COMMIT");
    res.json({ message: "Orden guardado", count: list.length });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};
