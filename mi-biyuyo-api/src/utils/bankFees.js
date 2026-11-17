const { convertToAll } = require("./currencyConverter");

/**
 * Comisiones bancarias. Cada entidad guarda reglas por método de pago (entities.fee_rules):
 *   { pago_movil: { pct, min, max }, transferencia: { pct, min, max } }
 * en la moneda de la entidad (pct = porcentaje del monto; min y max opcionales).
 * La comisión de cada operación la calcula la app y se guarda aquí tal cual (se puede editar).
 */
const METHODS = ["pago_movil", "transferencia"];
const ENTITY_CCY = { usd: "USD", ves: "VES", usdt: "BINANCE" };

const fail = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

/** Reglas de la entidad validadas y limpias (null si no hay ninguna). */
function cleanRules(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const m of METHODS) {
    const r = raw[m];
    if (!r || typeof r !== "object") continue;
    const pct = parseFloat(r.pct);
    const min = parseFloat(r.min);
    const max = parseFloat(r.max);
    const rule = {
      pct: pct > 0 ? pct : 0,
      min: min > 0 ? min : 0,
      max: max > 0 ? max : null,
    };
    if (rule.pct > 25) throw fail(422, "El porcentaje de la comisión no puede superar 25 %");
    if (rule.min > 1e9 || (rule.max && rule.max > 1e9))
      throw fail(422, "Monto de comisión inválido");
    if (rule.max !== null && rule.max < rule.min)
      throw fail(422, "El máximo de la comisión no puede ser menor al mínimo");
    if (rule.pct === 0 && rule.min === 0 && rule.max === null) continue;
    out[m] = rule;
  }
  return Object.keys(out).length ? out : null;
}

/** Comisión enviada ({ method, amount }) validada; null si no hay o es 0. */
function cleanFee(raw) {
  if (!raw || typeof raw !== "object") return null;
  const amount = parseFloat(raw.amount);
  if (!(amount > 0)) return null;
  if (!METHODS.includes(raw.method)) throw fail(422, "Método de comisión inválido");
  if (amount > 1e9) throw fail(422, "Monto de comisión inválido");
  return { method: raw.method, amount: Math.round(amount * 100) / 100 };
}

/**
 * Guarda una comisión ligada a un movimiento (transactionId) o a un abono (paymentId).
 * `entity` = { id, currency } de la entidad de la que sale; el monto va en su moneda.
 */
async function insertFee(client, { userId, entity, transactionId = null, paymentId = null, fee, date, rates }) {
  const currency = ENTITY_CCY[entity.currency] || "VES";
  const c = convertToAll(fee.amount, currency, rates);
  await client.query(
    `INSERT INTO bank_fees
       (user_id, entity_id, transaction_id, payment_id, method, amount, currency,
        amount_usd, amount_ves, amount_binance, date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      userId,
      entity.id,
      transactionId,
      paymentId,
      fee.method,
      fee.amount,
      currency,
      c.amount_usd,
      c.amount_ves,
      c.amount_binance,
      date,
    ],
  );
}

module.exports = { METHODS, cleanRules, cleanFee, insertFee, fail };
