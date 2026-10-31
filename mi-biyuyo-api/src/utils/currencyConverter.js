/**
 * Monedas soportadas: USD (base), VES (bolívares, tasa BCV) y BINANCE (USDT).
 * Tasas del usuario: usd_to_ves = VES por 1 USD; binance_to_ves = VES por 1 USDT.
 * Ej.: 1 USD = 850 VES y 1 USDT = 950 VES  →  850 VES = 1 USD = 0.894 USDT
 *      y 1 USDT = 950 VES = 1.117 USD.
 */

function rateError(message) {
  const err = new Error(message);
  err.status = 422;
  return err;
}

/** Unidades de la moneda por 1 USD (USD: 1, VES: usd_to_ves, USDT: usd_to_ves / binance_to_ves). */
function factorOf(currency, rates) {
  const ves = parseFloat(rates.usd_to_ves) || 0;
  const bin = parseFloat(rates.binance_to_ves) || 0;
  if (currency === "USD") return 1;
  if (currency === "VES") return ves;
  if (currency === "BINANCE") return ves > 0 && bin > 0 ? ves / bin : 0;
  return 0;
}

function round4(n) {
  return parseFloat(n.toFixed(4));
}

function toUsd(amount, currency, rates) {
  const f = factorOf(currency, rates);
  if (f <= 0) {
    throw rateError(
      currency === "BINANCE"
        ? "Configura las tasas BCV y Binance antes de registrar en USDT"
        : "Configura la tasa BCV antes de registrar en bolívares",
    );
  }
  return round4(parseFloat(amount) / f);
}

/** Convierte un monto a los 3 tipos: amount_usd / amount_ves (BCV) / amount_binance (USDT). */
function convertToAll(amount, currency, rates) {
  toUsd(amount, currency, rates); // valida que exista la tasa necesaria
  const usd = parseFloat(amount) / factorOf(currency, rates); // sin redondear
  const ves = factorOf("VES", rates);
  const bin = factorOf("BINANCE", rates);
  return {
    amount_usd: round4(usd),
    amount_ves: ves > 0 ? round4(usd * ves) : 0,
    amount_binance: bin > 0 ? round4(usd * bin) : 0,
  };
}

/**
 * Conversión según el modo del usuario (ctx = { mode, rates }).
 * En modo "single" no hay tasas: el monto está en la moneda base y solo se acepta "USD"
 * (alias interno de la moneda base).
 */
function checkSingle(currency) {
  if (currency !== "USD") {
    const err = new Error("En tu país solo se usa tu moneda local");
    err.status = 422;
    throw err;
  }
}

function toUsdFor(amount, currency, ctx) {
  if (ctx.mode === "single") {
    checkSingle(currency);
    return round4(parseFloat(amount));
  }
  return toUsd(amount, currency, ctx.rates);
}

function convertFor(amount, currency, ctx) {
  if (ctx.mode === "single") {
    checkSingle(currency);
    return {
      amount_usd: round4(parseFloat(amount)),
      amount_ves: 0,
      amount_binance: 0,
    };
  }
  return convertToAll(amount, currency, ctx.rates);
}

module.exports = { convertToAll, toUsd, factorOf, toUsdFor, convertFor };
