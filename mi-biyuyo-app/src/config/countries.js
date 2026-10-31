/**
 * Países disponibles (mismos códigos que la API: mi-biyuyo-api/src/config/countries.js).
 *  - mode "multi"  (Venezuela): USD como base, con equivalencias en VES (BCV) y USDT (Binance) y tasas.
 *  - mode "single" (resto): una sola moneda, la del país, sin equivalencias ni tasas.
 * El país se elige al registrarse y no cambia.
 */
const SINGLE = { mode: "single", symbolAfter: false, decimals: 2 };

export const COUNTRIES = {
  VE: {
    name: "Venezuela",
    mode: "multi",
    currency: "USD",
    currencyName: "Dólar, con equivalencia en bolívares y USDT",
    symbol: "USD",
    symbolAfter: false,
    decimals: 2,
    thousands: ",",
    decimal: ".",
    thresholdDefault: 50,
    thresholdStep: 10,
  },
  CO: {
    ...SINGLE,
    name: "Colombia",
    currency: "COP",
    currencyName: "Peso colombiano",
    symbol: "$",
    thousands: ".",
    decimal: ",",
    thresholdDefault: 50000,
    thresholdStep: 10000,
  },
  MX: {
    ...SINGLE,
    name: "México",
    currency: "MXN",
    currencyName: "Peso mexicano",
    symbol: "$",
    thousands: ",",
    decimal: ".",
    thresholdDefault: 500,
    thresholdStep: 100,
  },
  PE: {
    ...SINGLE,
    name: "Perú",
    currency: "PEN",
    currencyName: "Sol peruano",
    symbol: "S/",
    thousands: ",",
    decimal: ".",
    thresholdDefault: 150,
    thresholdStep: 50,
  },
  CL: {
    ...SINGLE,
    name: "Chile",
    currency: "CLP",
    currencyName: "Peso chileno",
    symbol: "$",
    decimals: 0,
    thousands: ".",
    decimal: ",",
    thresholdDefault: 50000,
    thresholdStep: 10000,
  },
  AR: {
    ...SINGLE,
    name: "Argentina",
    currency: "ARS",
    currencyName: "Peso argentino",
    symbol: "$",
    thousands: ".",
    decimal: ",",
    thresholdDefault: 20000,
    thresholdStep: 5000,
  },
  EC: {
    ...SINGLE,
    name: "Ecuador",
    currency: "USD",
    currencyName: "Dólar estadounidense",
    symbol: "$",
    thousands: ",",
    decimal: ".",
    thresholdDefault: 50,
    thresholdStep: 10,
  },
  DO: {
    ...SINGLE,
    name: "República Dominicana",
    currency: "DOP",
    currencyName: "Peso dominicano",
    symbol: "RD$",
    thousands: ",",
    decimal: ".",
    thresholdDefault: 3000,
    thresholdStep: 500,
  },
  ES: {
    ...SINGLE,
    name: "España",
    currency: "EUR",
    currencyName: "Euro",
    symbol: "€",
    symbolAfter: true,
    thousands: ".",
    decimal: ",",
    thresholdDefault: 50,
    thresholdStep: 10,
  },
  US: {
    ...SINGLE,
    name: "Estados Unidos",
    currency: "USD",
    currencyName: "Dólar estadounidense",
    symbol: "$",
    thousands: ",",
    decimal: ".",
    thresholdDefault: 50,
    thresholdStep: 10,
  },
};

export const DEFAULT_COUNTRY = "VE";

/** Lista para el selector: Venezuela primero y el resto por nombre. */
export const COUNTRY_LIST = Object.entries(COUNTRIES)
  .map(([code, c]) => ({ code, ...c }))
  .sort((a, b) =>
    a.code === DEFAULT_COUNTRY
      ? -1
      : b.code === DEFAULT_COUNTRY
        ? 1
        : a.name.localeCompare(b.name, "es"),
  );

/** Perfil del usuario (por su país; sin país o desconocido = Venezuela). */
export function profileFor(user) {
  const code = COUNTRIES[user?.country] ? user.country : DEFAULT_COUNTRY;
  const c = COUNTRIES[code];
  return { country: code, ...c, single: c.mode === "single" };
}
