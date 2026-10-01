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

exports.create = async (req, res, next) => {
  try {
    const { name, type, macro_type, icon, color, parent_id } = req.body;
    if (!name || !type)
      return res.status(422).json({ error: "name y type son requeridos" });

    const { rows } = await pool.query(
      `INSERT INTO categories (user_id, name, type, macro_type, icon, color, parent_id, is_default, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, 99) RETURNING *`,
      [
        req.user.id,
        name.trim(),
        type,
        macro_type || null,
        icon || "ellipse",
        color || "#4361EE",
        parent_id || null,
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
    const { name, icon, color, active } = req.body;

    // Cannot edit system defaults
    const { rows: existing } = await pool.query(
      `SELECT id, user_id, is_default FROM categories WHERE id = $1`,
      [id],
    );
    if (!existing.length)
      return res.status(404).json({ error: "Categoría no encontrada" });
    if (existing[0].user_id === null)
      return res
        .status(403)
        .json({ error: "No se pueden modificar categorías del sistema" });
    if (existing[0].user_id !== req.user.id)
      return res.status(403).json({ error: "Sin permiso" });

    const { rows } = await pool.query(
      `UPDATE categories SET
         name   = COALESCE($1, name),
         icon   = COALESCE($2, icon),
         color  = COALESCE($3, color),
         active = COALESCE($4, active)
       WHERE id = $5 RETURNING *`,
      [name || null, icon || null, color || null, active ?? null, id],
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT user_id FROM categories WHERE id = $1`,
      [id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Categoría no encontrada" });
    if (rows[0].user_id === null)
      return res
        .status(403)
        .json({ error: "No se pueden eliminar categorías del sistema" });
    if (rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: "Sin permiso" });

    // Soft-delete
    await pool.query(`UPDATE categories SET active = FALSE WHERE id = $1`, [
      id,
    ]);
    res.json({ message: "Categoría desactivada" });
  } catch (err) {
    next(err);
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
