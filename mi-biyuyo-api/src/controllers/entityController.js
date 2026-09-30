const pool = require("../config/database");

const KINDS = ["efectivo", "banco", "digital", "otro"];
const PTYPES = ["none", "pm", "acct", "email", "id"];

const cols = `id, name, kind, currency, initial_usd::float AS initial_usd,
              payment_type, payment_data, alert_usd::float AS alert_usd, created_at`;

function clean(body) {
  const name = String(body.name || "").trim();
  if (!name) {
    const err = new Error("El nombre es requerido");
    err.status = 422;
    throw err;
  }
  const kind = KINDS.includes(body.kind) ? body.kind : "otro";
  const currency = body.currency === "usd" ? "usd" : "ves";
  const paymentType = PTYPES.includes(body.payment_type)
    ? body.payment_type
    : "none";
  const paymentData = Array.isArray(body.payment_data)
    ? body.payment_data.map((v) => String(v ?? "").trim()).slice(0, 4)
    : [];
  const alert = parseFloat(body.alert_usd);
  return {
    name,
    kind,
    currency,
    paymentType,
    paymentData,
    alertUsd: alert > 0 ? alert : null,
    initialUsd: Math.max(0, parseFloat(body.initial_usd) || 0),
  };
}

exports.list = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${cols} FROM entities WHERE user_id = $1 ORDER BY id`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const d = clean(req.body);
    const { rows } = await pool.query(
      `INSERT INTO entities (user_id, name, kind, currency, initial_usd, payment_type, payment_data, alert_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${cols}`,
      [
        req.user.id,
        d.name,
        d.kind,
        d.currency,
        d.initialUsd,
        d.paymentType,
        JSON.stringify(d.paymentData),
        d.alertUsd,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// El saldo inicial solo se define al crear; al editar no se modifica.
exports.update = async (req, res, next) => {
  try {
    const d = clean(req.body);
    const { rows } = await pool.query(
      `UPDATE entities SET name=$1, kind=$2, currency=$3, payment_type=$4, payment_data=$5, alert_usd=$6
       WHERE id=$7 AND user_id=$8 RETURNING ${cols}`,
      [
        d.name,
        d.kind,
        d.currency,
        d.paymentType,
        JSON.stringify(d.paymentData),
        d.alertUsd,
        req.params.id,
        req.user.id,
      ],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Entidad no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { rows: used } = await pool.query(
      `SELECT (SELECT COUNT(*) FROM transactions WHERE entity_id = $1)
            + (SELECT COUNT(*) FROM transaction_payments WHERE entity_id = $1)
            + (SELECT COUNT(*) FROM transfers WHERE from_entity_id = $1 OR to_entity_id = $1) AS n`,
      [id],
    );
    if (parseInt(used[0].n) > 0)
      return res
        .status(409)
        .json({ error: "La entidad tiene movimientos y no se puede eliminar" });
    const { rows } = await pool.query(
      `DELETE FROM entities WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Entidad no encontrada" });
    res.json({ message: "Entidad eliminada" });
  } catch (err) {
    next(err);
  }
};
