/**
 * Convierte un monto desde una moneda origen a los 3 tipos soportados.
 * @param {number} amount  Monto original
 * @param {'USD'|'VES'|'BINANCE'} currency  Moneda de origen
 * @param {{ usd_to_ves: number, binance_to_ves: number }} rates  Tasas del usuario
 * @returns {{ amount_usd, amount_ves, amount_binance }}
 */
function convertToAll(amount, currency, rates) {
  const { usd_to_ves, binance_to_ves } = rates;
  const amt = parseFloat(amount);

  if (currency === "USD") {
    return {
      amount_usd: amt,
      amount_ves:
        usd_to_ves > 0 ? parseFloat((amt * usd_to_ves).toFixed(4)) : 0,
      amount_binance:
        binance_to_ves > 0
          ? parseFloat((amt * (usd_to_ves / binance_to_ves)).toFixed(4))
          : amt,
    };
  }
  if (currency === "VES") {
    return {
      amount_usd:
        usd_to_ves > 0 ? parseFloat((amt / usd_to_ves).toFixed(4)) : 0,
      amount_ves: amt,
      amount_binance:
        binance_to_ves > 0 ? parseFloat((amt / binance_to_ves).toFixed(4)) : 0,
    };
  }
  // BINANCE (USDT P2P)
  return {
    amount_usd:
      usd_to_ves > 0 && binance_to_ves > 0
        ? parseFloat((amt * (binance_to_ves / usd_to_ves)).toFixed(4))
        : amt,
    amount_ves:
      binance_to_ves > 0 ? parseFloat((amt * binance_to_ves).toFixed(4)) : 0,
    amount_binance: amt,
  };
}

module.exports = { convertToAll };
