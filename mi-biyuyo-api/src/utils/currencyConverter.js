/**
 * Monedas soportadas: USD (base), VES (tasa BCV) y BINANCE (VES a tasa Binance P2P).
 * Los montos VES y BINANCE se expresan en bolívares; ambos tienen su propia tasa.
 */
function factorOf(currency, rates) {
  if (currency === "USD") return 1;
  if (currency === "VES") return parseFloat(rates.usd_to_ves) || 0;
  if (currency === "BINANCE") return parseFloat(rates.binance_to_ves) || 0;
  return 0;
}

function round4(n) {
  return parseFloat(n.toFixed(4));
}

function toUsd(amount, currency, rates) {
  const f = factorOf(currency, rates);
  if (f <= 0) {
    const err = new Error(
      currency === "BINANCE"
        ? "Configura la tasa Binance antes de registrar en esa moneda"
        : "Configura la tasa BCV antes de registrar en bolívares",
    );
    err.status = 422;
    throw err;
  }
  return round4(parseFloat(amount) / f);
}

/** Convierte un monto a los 3 tipos: amount_usd / amount_ves (BCV) / amount_binance. */
function convertToAll(amount, currency, rates) {
  const usd = toUsd(amount, currency, rates);
  const ves = parseFloat(rates.usd_to_ves) || 0;
  const bin = parseFloat(rates.binance_to_ves) || 0;
  return {
    amount_usd: usd,
    amount_ves: ves > 0 ? round4(usd * ves) : 0,
    amount_binance: bin > 0 ? round4(usd * bin) : 0,
  };
}

module.exports = { convertToAll, toUsd, factorOf };
