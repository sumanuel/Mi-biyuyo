const pool = require("../config/database");
const { getPlanState, listPlans } = require("../utils/subscription");
const { getBcvRate } = require("../utils/bcv");
const { makeLimiter } = require("../utils/throttle");
const {
  ccyOfMethod,
  extendPremium,
  normalizeCode,
  mailPaymentReceived,
  mailAdminNewPayment,
} = require("../utils/billing");

const MAX_PENDING = 3; // pagos en revisión por usuario
const MAX_PROOF_CHARS = 3_000_000; // ~2 MB de imagen o PDF en base64
const MIN_PAID_RATIO = 0.5; // un monto menor a la mitad del plan es un error evidente
const redeemFails = makeLimiter(5, 60 * 60 * 1000); // 5 códigos incorrectos por hora y usuario

function fail(status, message, extra) {
  const err = new Error(message);
  err.status = status;
  if (extra) err.extra = extra;
  return err;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Estado del plan del usuario y planes a la venta (precio y días)
exports.get = async (req, res, next) => {
  try {
    res.json({
      ...(await getPlanState(req.user.id)),
      plans: await listPlans(),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Cómo pagar: tus cuentas de cobro activas y lo que cuesta cada plan en USD y en bolívares
 * (con la tasa BCV oficial del servidor, no la que el usuario tenga guardada).
 */
exports.receivers = async (req, res, next) => {
  try {
    const [plans, recv, bcv] = await Promise.all([
      listPlans(),
      pool.query(
        `SELECT id, method, label, details FROM payment_receivers
         WHERE active = TRUE ORDER BY sort_order, id`,
      ),
      getBcvRate(),
    ]);
    res.json({
      bcv_rate: bcv ? bcv.rate : null,
      plans: plans.map((p) => ({
        ...p,
        amount_ves: bcv ? round2(p.price_usd * bcv.rate) : null,
      })),
      receivers: recv.rows.map((r) => ({ ...r, currency: ccyOfMethod(r.method) })),
    });
  } catch (err) {
    next(err);
  }
};

// «Ya pagué»: el usuario informa su pago; queda pendiente hasta que el administrador lo apruebe
exports.createPayment = async (req, res, next) => {
  try {
    const b = req.body || {};
    const planCode = String(b.plan_code || "");
    const method = String(b.method || "");
    const reference = String(b.reference || "").trim().replace(/\s+/g, " ");
    const paid = parseFloat(b.paid_amount);

    const { rows: planRows } = await pool.query(
      `SELECT code, name, price_usd::float AS price_usd, days FROM subscription_plans
       WHERE code = $1 AND active = TRUE`,
      [planCode],
    );
    if (!planRows.length) throw fail(422, "Plan no disponible");
    const plan = planRows[0];

    const { rows: recv } = await pool.query(
      `SELECT 1 FROM payment_receivers WHERE method = $1 AND active = TRUE LIMIT 1`,
      [method],
    );
    if (!recv.length) throw fail(422, "Método de pago no disponible");
    if (reference.length < 4 || reference.length > 80)
      throw fail(422, "Escribe la referencia del pago (entre 4 y 80 caracteres)");
    if (!(paid > 0)) throw fail(422, "Escribe el monto que pagaste");

    const ccy = ccyOfMethod(method);
    let expected = plan.price_usd;
    let rateUsed = null;
    if (ccy === "VES") {
      const bcv = await getBcvRate();
      if (!bcv)
        throw fail(503, "No hay tasa BCV disponible ahora. Intenta más tarde o paga en USD (Zinli o PayPal)");
      expected = round2(plan.price_usd * bcv.rate);
      rateUsed = bcv.rate;
    }
    if (paid < expected * MIN_PAID_RATIO)
      throw fail(422, "El monto es menor al que cuesta el plan");

    let proof = b.proof_data ? String(b.proof_data) : null;
    if (proof) {
      if (!/^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i.test(proof))
        throw fail(422, "El comprobante debe ser una imagen o un PDF");
      if (proof.length > MAX_PROOF_CHARS)
        throw fail(422, "El comprobante es demasiado grande (máximo 2 MB)");
    }

    const { rows: pend } = await pool.query(
      `SELECT count(*)::int n FROM subscription_payments WHERE user_id = $1 AND status = 'pending'`,
      [req.user.id],
    );
    if (pend[0].n >= MAX_PENDING)
      throw fail(429, `Ya tienes ${MAX_PENDING} pagos en revisión. Espera a que los revisemos`);

    let row;
    try {
      ({ rows: [row] } = await pool.query(
        `INSERT INTO subscription_payments
           (user_id, plan_code, plan_days, amount_usd, method, reference, paid_amount, paid_currency,
            expected_amount, expected_currency, rate_used, proof_data, proof_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id, plan_code, method, reference, expected_amount::float AS expected_amount,
                   expected_currency, paid_amount::float AS paid_amount, status, requested_at`,
        [
          req.user.id,
          plan.code,
          plan.days,
          plan.price_usd,
          method,
          reference,
          paid,
          ccy,
          expected,
          ccy,
          rateUsed,
          proof,
          b.proof_name ? String(b.proof_name).slice(0, 120) : null,
        ],
      ));
    } catch (e) {
      if (e.code === "23505")
        throw fail(409, "Esa referencia ya fue registrada. Si es tuya y fue un error, contáctanos");
      throw e;
    }

    const { rows: u } = await pool.query(`SELECT name, email FROM users WHERE id = $1`, [req.user.id]);
    await mailPaymentReceived(u[0], row);
    await mailAdminNewPayment(u[0], row);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

// Pagos del propio usuario (sin el comprobante)
exports.listPayments = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, plan_code, method, reference, expected_amount::float AS expected_amount,
              expected_currency, paid_amount::float AS paid_amount, status, reject_reason,
              requested_at, reviewed_at
       FROM subscription_payments WHERE user_id = $1
       ORDER BY requested_at DESC LIMIT 20`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// Canjear un código: suma los días de su plan (o los días sueltos) al Premium del usuario
exports.redeem = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const key = String(req.user.id);
    const wait = redeemFails.blockedFor(key);
    if (wait)
      throw fail(429, "Demasiados códigos incorrectos. Intenta de nuevo más tarde", {
        retry_after: wait,
      });
    const code = normalizeCode(req.body?.code);
    if (code.length < 6) {
      redeemFails.fail(key);
      throw fail(400, "Código inválido, vencido o ya usado");
    }

    await client.query("BEGIN");
    // El UPDATE condicional hace que un código se pueda usar una sola vez aunque lleguen dos a la vez
    const { rows } = await client.query(
      `UPDATE redeem_codes c SET used_by = $2, used_at = NOW()
       WHERE c.code = $1 AND c.used_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > NOW())
       RETURNING c.days, (SELECT days FROM subscription_plans WHERE code = c.plan_code) AS plan_days`,
      [code, req.user.id],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      redeemFails.fail(key);
      throw fail(400, "Código inválido, vencido o ya usado");
    }
    const days = rows[0].days || rows[0].plan_days;
    const until = await extendPremium(client, req.user.id, days);
    await client.query("COMMIT");
    redeemFails.clear(key);
    res.json({ days, premium_until: until, ...(await getPlanState(req.user.id)) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};
