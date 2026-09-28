/**
 * Formatea un monto con el símbolo de la moneda y decimales.
 * @param {number} amount
 * @param {'USD'|'VES'|'BINANCE'} currency
 * @param {{ usd_to_ves?: number, binance_to_ves?: number }} rates
 */
export function formatAmount(amount, currency) {
  if (amount == null || isNaN(amount)) return "—";
  const n = parseFloat(amount);
  switch (currency) {
    case "USD":
      return `$${n.toFixed(2)}`;
    case "VES":
      return `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "BINANCE":
      return `₮${n.toFixed(2)}`;
    default:
      return n.toFixed(2);
  }
}

export const CURRENCY_LABELS = {
  USD: "Dólares (USD)",
  VES: "Bolívares (VES)",
  BINANCE: "Binance (USDT)",
};

export const CURRENCY_SYMBOLS = {
  USD: "$",
  VES: "Bs.",
  BINANCE: "₮",
};

export const CURRENCIES = ["USD", "VES", "BINANCE"];

/** Toma un objeto transaction y devuelve los 3 montos formateados. */
export function getTransactionAmounts(tx) {
  return {
    usd: formatAmount(tx.amount_usd, "USD"),
    ves: formatAmount(tx.amount_ves, "VES"),
    binance: formatAmount(tx.amount_binance, "BINANCE"),
  };
}
