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
