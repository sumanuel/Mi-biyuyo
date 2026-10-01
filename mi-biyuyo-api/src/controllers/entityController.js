const pool = require("../config/database");
const { toUsd } = require("../utils/currencyConverter");
const { getUserCtx } = require("../utils/userContext");

const KINDS = ["efectivo", "banco", "digital", "otro"];
const PTYPES = ["none", "pm", "acct", "email", "id"];

const cols = `id, name, kind, currency, initial_usd::float AS initial_usd, initial_amount::float AS initial_amount,
              payment_type, payment_data, alert_usd::float AS alert_usd,
              include_in_balance, created_at`;

function clean(body, mode) {
  const name = String(body.name || "").trim();
  if (!name) {
    const err = new Error("El nombre es requerido");
    err.status = 422;
    throw err;
  }
  const kind = KINDS.includes(body.kind) ? body.kind : "otro";
  // En modo single la única moneda es la base (alias "usd"); en multi: usd, usdt o ves
  const currency =
    mode === "single"
      ? "usd"
      : ["usd", "usdt"].includes(body.currency)
        ? body.currency
        : "ves";
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
    include: body.include_in_balance !== false,
    // Saldo inicial en la moneda de la entidad (USD, VES o USDT)
    initialAmount: Math.max(
      0,
      parseFloat(body.initial_amount ?? body.initial_usd) || 0,
    ),
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
    const ctx = await getUserCtx(req.user.id);
    const d = clean(req.body, ctx.mode);
    let initialUsd = d.initialAmount;
    if (d.currency !== "usd" && d.initialAmount > 0) {
      initialUsd = toUsd(
        d.initialAmount,
        d.currency === "usdt" ? "BINANCE" : "VES",
        ctx.rates,
      );
    }
    const { rows } = await pool.query(
      `INSERT INTO entities (user_id, name, kind, currency, initial_usd, initial_amount, payment_type, payment_data, alert_usd, include_in_balance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${cols}`,
      [
        req.user.id,
        d.name,
        d.kind,
        d.currency,
        initialUsd,
        d.initialAmount,
        d.paymentType,
        JSON.stringify(d.paymentData),
        d.alertUsd,
        d.include,
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
    const ctx = await getUserCtx(req.user.id);
    const d = clean(req.body, ctx.mode);
    const { rows } = await pool.query(
      `UPDATE entities SET name=$1, kind=$2, currency=$3, payment_type=$4, payment_data=$5, alert_usd=$6, include_in_balance=$7
       WHERE id=$8 AND user_id=$9 RETURNING ${cols}`,
      [
        d.name,
        d.kind,
        d.currency,
        d.paymentType,
        JSON.stringify(d.paymentData),
        d.alertUsd,
        d.include,
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
