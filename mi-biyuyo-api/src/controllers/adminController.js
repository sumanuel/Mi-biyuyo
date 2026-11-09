const pool = require("../config/database");
const { getPlanState } = require("../utils/subscription");
const {
  extendPremium,
  makeCode,
  formatCode,
  mailPaymentApproved,
  mailPaymentRejected,
} = require("../utils/billing");

/** Panel de administración: pagos, códigos, usuarios, configuración, planes y datos de cobro. */

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const int = (v, min, max, label) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw fail(422, `${label} debe ser un entero entre ${min} y ${max}`);
  return n;
};

/* ---------- pagos ---------- */
exports.listPayments = async (req, res, next) => {
  try {
    const status = ["pending", "approved", "rejected"].includes(req.query.status)
      ? req.query.status
      : null;
    const { rows } = await pool.query(
      `SELECT p.id, p.user_id, u.email, u.name, p.plan_code, p.plan_days, p.method, p.reference,
              p.expected_amount::float AS expected_amount, p.expected_currency,
              p.paid_amount::float AS paid_amount, p.paid_currency, p.rate_used::float AS rate_used,
              p.status, p.reject_reason, p.requested_at, p.reviewed_at,
              (p.proof_data IS NOT NULL) AS has_proof, p.proof_name
       FROM subscription_payments p JOIN users u ON u.id = p.user_id
       WHERE ($1::text IS NULL OR p.status = $1)
       ORDER BY (p.status = 'pending') DESC, p.requested_at DESC
       LIMIT 200`,
      [status],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.proof = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT proof_name AS name, proof_data AS data FROM subscription_payments WHERE id = $1`,
      [req.params.id],
    );
    if (!rows.length || !rows[0].data) throw fail(404, "Sin comprobante");
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// Aprobar: el UPDATE condicional impide aprobar dos veces el mismo pago
exports.approve = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE subscription_payments SET status = 'approved', reviewed_at = NOW(), reject_reason = NULL
       WHERE id = $1 AND status = 'pending'
       RETURNING id, user_id, plan_code, plan_days, method, reference`,
      [req.params.id],
    );
    if (!rows.length) throw fail(409, "El pago no existe o ya fue revisado");
    const p = rows[0];
    const days =
      p.plan_days ||
      (await client.query(`SELECT days FROM subscription_plans WHERE code = $1`, [p.plan_code]))
        .rows[0].days;
    const until = await extendPremium(client, p.user_id, days);
    await client.query("COMMIT");
    const { rows: u } = await pool.query(`SELECT name, email FROM users WHERE id = $1`, [p.user_id]);
    await mailPaymentApproved(u[0], p, until);
    res.json({ id: p.id, status: "approved", premium_until: until });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

exports.reject = async (req, res, next) => {
  try {
    const reason = String(req.body?.reason || "").trim().slice(0, 255);
    if (reason.length < 3) throw fail(422, "Escribe el motivo del rechazo");
    const { rows } = await pool.query(
      `UPDATE subscription_payments SET status = 'rejected', reviewed_at = NOW(), reject_reason = $2
       WHERE id = $1 AND status = 'pending' RETURNING id, user_id, reference, method`,
      [req.params.id, reason],
    );
    if (!rows.length) throw fail(409, "El pago no existe o ya fue revisado");
    const { rows: u } = await pool.query(`SELECT name, email FROM users WHERE id = $1`, [rows[0].user_id]);
    await mailPaymentRejected(u[0], rows[0], reason);
    res.json({ id: rows[0].id, status: "rejected" });
  } catch (err) {
    next(err);
  }
};

/* ---------- códigos de canje ---------- */
exports.listCodes = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.code, c.plan_code, c.days, c.expires_at, c.created_at, c.used_at, u.email AS used_by_email
       FROM redeem_codes c LEFT JOIN users u ON u.id = c.used_by
       ORDER BY c.created_at DESC, c.id DESC LIMIT 100`,
    );
    res.json(rows.map((r) => ({ ...r, code: formatCode(r.code) })));
  } catch (err) {
    next(err);
  }
};

exports.createCodes = async (req, res, next) => {
  try {
    const b = req.body || {};
    const count = int(b.count ?? 1, 1, 50, "La cantidad");
    let planCode = null;
    let days = null;
    if (b.plan_code) {
      const { rows } = await pool.query(`SELECT code FROM subscription_plans WHERE code = $1`, [b.plan_code]);
      if (!rows.length) throw fail(422, "Plan inexistente");
      planCode = rows[0].code;
    } else {
      days = int(b.days, 1, 3650, "Los días");
    }
    const expiresIn = b.expires_in_days ? int(b.expires_in_days, 1, 730, "La vigencia del código") : null;
    const out = [];
    for (let i = 0; i < count; i++) {
      const { rows } = await pool.query(
        `INSERT INTO redeem_codes (code, plan_code, days, expires_at)
         VALUES ($1, $2, $3, CASE WHEN $4::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $4::int) END)
         RETURNING code`,
        [makeCode(), planCode, days, expiresIn],
      );
      out.push(formatCode(rows[0].code));
    }
    res.status(201).json({ codes: out });
  } catch (err) {
    next(err);
  }
};

exports.deleteCode = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM redeem_codes WHERE id = $1 AND used_at IS NULL`,
      [req.params.id],
    );
    if (!rowCount) throw fail(409, "El código no existe o ya fue usado");
    res.json({ message: "Código eliminado" });
  } catch (err) {
    next(err);
  }
};

/* ---------- usuarios y días ---------- */
exports.findUsers = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 3) throw fail(422, "Escribe al menos 3 letras del correo");
    const { rows } = await pool.query(
      `SELECT id, name, email, trial_ends_at, premium_until, email_verified FROM users
       WHERE email ILIKE $1 ORDER BY email LIMIT 20`,
      [`%${q.replace(/[%_\\]/g, "\\$&")}%`],
    );
    const out = [];
    for (const u of rows) out.push({ ...u, plan: (await getPlanState(u.id)).plan });
    res.json(out);
  } catch (err) {
    next(err);
  }
};

// Regalar días de Premium (solo suma) o sumar/restar días a la prueba de un usuario
exports.gift = async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const target = req.body?.target === "trial" ? "trial" : "premium";
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (!rows.length) throw fail(404, "No hay un usuario con ese correo");
    const id = rows[0].id;

    if (target === "premium") {
      const days = int(req.body?.days, 1, 3650, "Los días");
      return res.json({ premium_until: await extendPremium(pool, id, days) });
    }
    const days = int(req.body?.days, -365, 365, "Los días");
    if (days === 0) throw fail(422, "Los días no pueden ser 0");
    // Nunca se lleva el fin de la prueba antes de hoy; si no tenía prueba, se parte de hoy
    const r = await pool.query(
      `UPDATE users
       SET trial_ends_at = GREATEST(NOW(), COALESCE(trial_ends_at, NOW()) + make_interval(days => $2)),
           trial_days_granted = COALESCE(trial_days_granted, 0), updated_at = NOW()
       WHERE id = $1 RETURNING trial_ends_at`,
      [id, days],
    );
    res.json({ trial_ends_at: r.rows[0].trial_ends_at });
  } catch (err) {
    next(err);
  }
};

// Suma o resta días a la prueba de TODOS los que están en prueba ahora (pide confirmación explícita)
exports.bulkTrial = async (req, res, next) => {
  try {
    if (req.body?.confirm !== true) throw fail(422, "Falta la confirmación");
    const days = int(req.body?.days, -365, 365, "Los días");
    if (days === 0) throw fail(422, "Los días no pueden ser 0");
    const r = await pool.query(
      `UPDATE users
       SET trial_ends_at = GREATEST(NOW(), trial_ends_at + make_interval(days => $1)), updated_at = NOW()
       WHERE trial_ends_at > NOW() AND (premium_until IS NULL OR premium_until <= NOW())`,
      [days],
    );
    res.json({ updated: r.rowCount });
  } catch (err) {
    next(err);
  }
};

/* ---------- configuración ---------- */
const SETTING_KEYS = ["trial_days", "trial_days_existing", "bcv_rate_override"];

exports.getSettings = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT key, value, updated_at, updated_by FROM app_settings WHERE key = ANY($1)`,
      [SETTING_KEYS],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.putSettings = async (req, res, next) => {
  try {
    const entries = Object.entries(req.body || {});
    if (!entries.length) throw fail(422, "No hay cambios");
    for (const [key, raw] of entries) {
      if (!SETTING_KEYS.includes(key)) throw fail(422, `Ajuste desconocido: ${key}`);
      if (key === "bcv_rate_override") {
        const v = String(raw ?? "").trim();
        if (v === "") {
          await pool.query(`DELETE FROM app_settings WHERE key = $1`, [key]);
          continue;
        }
        const n = Number(v);
        if (!(n > 0 && n < 1e6)) throw fail(422, "La tasa BCV debe ser un número mayor a 0");
        await upsertSetting(key, String(n));
      } else {
        await upsertSetting(key, String(int(raw, 0, 365, "Los días de prueba")));
      }
    }
    res.json({ message: "Guardado" });
  } catch (err) {
    next(err);
  }
};

const upsertSetting = (key, value) =>
  pool.query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2, 'admin')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = 'admin'`,
    [key, value],
  );

/* ---------- planes ---------- */
exports.listPlans = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT code, name, price_usd::float AS price_usd, days, active, sort_order
       FROM subscription_plans ORDER BY sort_order, code`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.updatePlan = async (req, res, next) => {
  try {
    const b = req.body || {};
    const price = Number(b.price_usd);
    if (!(price >= 0.5 && price <= 1000)) throw fail(422, "El precio debe estar entre 0,50 y 1000 USD");
    const days = int(b.days, 1, 3650, "Los días del plan");
    const name = String(b.name || "").trim().slice(0, 40);
    const { rows } = await pool.query(
      `UPDATE subscription_plans
       SET price_usd = $2, days = $3, active = $4, name = COALESCE(NULLIF($5, ''), name)
       WHERE code = $1 RETURNING code, name, price_usd::float AS price_usd, days, active`,
      [req.params.code, price, days, b.active !== false, name],
    );
    if (!rows.length) throw fail(404, "Plan no encontrado");
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

/* ---------- datos de cobro ---------- */
function cleanReceiver(b) {
  const method = String(b.method || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{2,30}$/.test(method))
    throw fail(422, "El método debe tener 2 a 30 letras minúsculas, números o guion bajo (ej: pago_movil)");
  const label = String(b.label || "").trim();
  if (!label || label.length > 80) throw fail(422, "El nombre visible es requerido (máximo 80 caracteres)");
  const details = (Array.isArray(b.details) ? b.details : [])
    .slice(0, 8)
    .map((d) => ({ label: String(d?.label || "").trim().slice(0, 60), value: String(d?.value || "").trim().slice(0, 160) }))
    .filter((d) => d.label && d.value);
  if (!details.length) throw fail(422, "Agrega al menos un dato de cobro (campo y valor)");
  return {
    method,
    label,
    details,
    active: b.active !== false,
    sort: Number.isInteger(Number(b.sort_order)) ? Number(b.sort_order) : 0,
  };
}

exports.listReceivers = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, method, label, details, active, sort_order FROM payment_receivers ORDER BY sort_order, id`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.createReceiver = async (req, res, next) => {
  try {
    const d = cleanReceiver(req.body || {});
    const { rows } = await pool.query(
      `INSERT INTO payment_receivers (method, label, details, active, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, method, label, details, active, sort_order`,
      [d.method, d.label, JSON.stringify(d.details), d.active, d.sort],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateReceiver = async (req, res, next) => {
  try {
    const d = cleanReceiver(req.body || {});
    const { rows } = await pool.query(
      `UPDATE payment_receivers SET method=$2, label=$3, details=$4, active=$5, sort_order=$6
       WHERE id = $1 RETURNING id, method, label, details, active, sort_order`,
      [req.params.id, d.method, d.label, JSON.stringify(d.details), d.active, d.sort],
    );
    if (!rows.length) throw fail(404, "Dato de cobro no encontrado");
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.deleteReceiver = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM payment_receivers WHERE id = $1`, [req.params.id]);
    if (!rowCount) throw fail(404, "Dato de cobro no encontrado");
    res.json({ message: "Eliminado" });
  } catch (err) {
    next(err);
  }
};
