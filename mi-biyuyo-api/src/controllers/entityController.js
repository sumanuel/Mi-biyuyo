const pool = require("../config/database");
const { toUsd } = require("../utils/currencyConverter");
const { insertAdjustment } = require("./adjustmentController");
const { requireFeature, requireNewEntity } = require("../utils/subscription");

const KINDS = ["efectivo", "banco", "digital", "otro"];
const PTYPES = ["none", "pm", "acct", "email", "id"];

const cols = `id, name, kind, currency, initial_usd::float AS initial_usd, initial_amount::float AS initial_amount,
              payment_type, payment_data, alert_usd::float AS alert_usd,
              include_in_balance, created_at, archived_at`;

function clean(body) {
  const name = String(body.name || "").trim();
  if (!name) {
    const err = new Error("El nombre es requerido");
    err.status = 422;
    throw err;
  }
  const kind = KINDS.includes(body.kind) ? body.kind : "otro";
  const currency = ["usd", "usdt"].includes(body.currency) ? body.currency : "ves";
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

// Guarda el orden que el usuario eligió para sus entidades (lista de ids, de la primera a la última).
exports.reorder = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const ids = [...new Set((req.body.ids || []).map(Number))].filter((n) =>
      Number.isInteger(n),
    );
    if (!ids.length || ids.length > 300)
      return res.status(422).json({ error: "Lista de entidades inválida" });
    await client.query("BEGIN");
    await client.query(
      `UPDATE entities e SET sort_order = x.pos
       FROM unnest($2::int[], $3::int[]) AS x(id, pos)
       WHERE e.id = x.id AND e.user_id = $1`,
      [req.user.id, ids, ids.map((_, i) => i)],
    );
    await client.query("COMMIT");
    res.json({ message: "Orden guardado", count: ids.length });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

exports.list = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${cols} FROM entities WHERE user_id = $1 ORDER BY COALESCE(sort_order, 1000000), id`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    await requireNewEntity(req.user.id); // Gratis: una sola entidad activa
    const d = clean(req.body);
    let initialUsd = d.initialAmount;
    if (d.currency !== "usd" && d.initialAmount > 0) {
      const { rows: r } = await pool.query(
        `SELECT usd_to_ves, binance_to_ves FROM exchange_rates WHERE user_id = $1`,
        [req.user.id],
      );
      initialUsd = toUsd(
        d.initialAmount,
        d.currency === "usdt" ? "BINANCE" : "VES",
        r[0] || {},
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

// Cantidad de movimientos (movimientos, abonos, transferencias y ajustes) que tocan una entidad
const USED_SQL = `SELECT (SELECT COUNT(*) FROM transactions WHERE entity_id = $1)
            + (SELECT COUNT(*) FROM transaction_payments WHERE entity_id = $1)
            + (SELECT COUNT(*) FROM transfers WHERE from_entity_id = $1 OR to_entity_id = $1)
            + (SELECT COUNT(*) FROM balance_adjustments WHERE entity_id = $1) AS n`;

// El saldo inicial solo se puede corregir mientras la entidad no tenga movimientos; después,
// el saldo se corrige con un ajuste (así el historial no cambia hacia atrás).
exports.update = async (req, res, next) => {
  try {
    const d = clean(req.body);
    const { rows: cur } = await pool.query(
      `SELECT initial_amount::float AS initial_amount FROM entities WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!cur.length)
      return res.status(404).json({ error: "Entidad no encontrada" });

    const sentInitial =
      req.body.initial_amount !== undefined ||
      req.body.initial_usd !== undefined;
    let initial = null; // { usd, amount } a guardar
    if (sentInitial) {
      const { rows: used } = await pool.query(USED_SQL, [req.params.id]);
      const hasMoves = parseInt(used[0].n) > 0;
      const changed =
        Math.abs(d.initialAmount - (cur[0].initial_amount || 0)) > 0.00005;
      if (hasMoves && changed)
        return res.status(409).json({
          error:
            "La entidad ya tiene movimientos: usa «Ajustar saldo» para corregir el saldo",
        });
      if (!hasMoves) {
        let usd = d.initialAmount;
        if (d.currency !== "usd" && d.initialAmount > 0) {
          const { rows: r } = await pool.query(
            `SELECT usd_to_ves, binance_to_ves FROM exchange_rates WHERE user_id = $1`,
            [req.user.id],
          );
          usd = toUsd(
            d.initialAmount,
            d.currency === "usdt" ? "BINANCE" : "VES",
            r[0] || {},
          );
        }
        initial = { usd, amount: d.initialAmount };
      }
    }

    const { rows } = await pool.query(
      `UPDATE entities SET name=$1, kind=$2, currency=$3, payment_type=$4, payment_data=$5, alert_usd=$6, include_in_balance=$7,
              initial_usd = COALESCE($10, initial_usd), initial_amount = COALESCE($11, initial_amount)
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
        initial ? initial.usd : null,
        initial ? initial.amount : null,
      ],
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { rows: used } = await pool.query(USED_SQL, [id]);
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

// Archivar: la entidad deja de sumar a Mi saldo y de salir al registrar, pero su historial se conserva.
// Si trae `adjust_amount` (con signo, en la moneda de la entidad), antes se registra ese ajuste para
// dejar el saldo en 0 («cerrar la entidad»); todo en una sola transacción.
exports.archive = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await requireFeature(req.user.id, "multi_entity");
    await client.query("BEGIN");
    const { rows: ents } = await client.query(
      `SELECT id, currency, archived_at FROM entities WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [req.params.id, req.user.id],
    );
    if (!ents.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Entidad no encontrada" });
    }
    if (ents[0].archived_at) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "La entidad ya está archivada" });
    }
    const n = parseFloat(req.body.adjust_amount);
    if (Number.isFinite(n) && Math.abs(n) >= 0.0001)
      await insertAdjustment(
        client,
        req.user.id,
        ents[0],
        n,
        null,
        req.body.note || "Cierre de la entidad",
      );
    const { rows } = await client.query(
      `UPDATE entities SET archived_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING ${cols}`,
      [req.params.id, req.user.id],
    );
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

exports.restore = async (req, res, next) => {
  try {
    await requireFeature(req.user.id, "multi_entity");
    const { rows } = await pool.query(
      `UPDATE entities SET archived_at = NULL WHERE id = $1 AND user_id = $2 RETURNING ${cols}`,
      [req.params.id, req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Entidad no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};
