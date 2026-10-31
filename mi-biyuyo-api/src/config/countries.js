/**
 * Países disponibles. El país se elige al registrarse y no cambia.
 *  - mode "multi"  (Venezuela): USD como base, con equivalencia en VES (tasa BCV) y USDT (Binance).
 *  - mode "single" (resto): una sola moneda, la del país; sin equivalencias ni tasas.
 *
 * En modo "single" la moneda del país se guarda en las columnas existentes (amount_usd,
 * currency = "USD") como "monto en moneda base": así no cambian el esquema ni los cálculos.
 * `currency` es el código ISO 4217 de la moneda base del usuario (se guarda en users.base_currency).
 *
 * Alcance (octubre de 2026): Sudamérica, Centroamérica, México, República Dominicana,
 * Estados Unidos, Portugal y España. Debe coincidir con mi-biyuyo-app/src/config/countries.js.
 */
const COUNTRIES = {
  // Sudamérica
  AR: { name: "Argentina", region: "sur", mode: "single", currency: "ARS" },
  BO: { name: "Bolivia", region: "sur", mode: "single", currency: "BOB" },
  BR: { name: "Brasil", region: "sur", mode: "single", currency: "BRL" },
  CL: { name: "Chile", region: "sur", mode: "single", currency: "CLP" },
  CO: { name: "Colombia", region: "sur", mode: "single", currency: "COP" },
  EC: { name: "Ecuador", region: "sur", mode: "single", currency: "USD" },
  GY: { name: "Guyana", region: "sur", mode: "single", currency: "GYD" },
  PY: { name: "Paraguay", region: "sur", mode: "single", currency: "PYG" },
  PE: { name: "Perú", region: "sur", mode: "single", currency: "PEN" },
  SR: { name: "Surinam", region: "sur", mode: "single", currency: "SRD" },
  UY: { name: "Uruguay", region: "sur", mode: "single", currency: "UYU" },
  VE: { name: "Venezuela", region: "sur", mode: "multi", currency: "USD" },
  // Centroamérica
  BZ: { name: "Belice", region: "centro", mode: "single", currency: "BZD" },
  CR: { name: "Costa Rica", region: "centro", mode: "single", currency: "CRC" },
  SV: { name: "El Salvador", region: "centro", mode: "single", currency: "USD" },
  GT: { name: "Guatemala", region: "centro", mode: "single", currency: "GTQ" },
  HN: { name: "Honduras", region: "centro", mode: "single", currency: "HNL" },
  NI: { name: "Nicaragua", region: "centro", mode: "single", currency: "NIO" },
  PA: { name: "Panamá", region: "centro", mode: "single", currency: "USD" },
  // Norteamérica y Caribe
  MX: { name: "México", region: "norte", mode: "single", currency: "MXN" },
  DO: { name: "República Dominicana", region: "norte", mode: "single", currency: "DOP" },
  // Otros
  US: { name: "Estados Unidos", region: "otros", mode: "single", currency: "USD" },
  PT: { name: "Portugal", region: "otros", mode: "single", currency: "EUR" },
  ES: { name: "España", region: "otros", mode: "single", currency: "EUR" },
};

const DEFAULT_COUNTRY = "VE";

/** Perfil del país, o null si el código no existe. */
function profileOf(code) {
  const key = String(code || "").toUpperCase();
  const c = COUNTRIES[key];
  return c ? { country: key, ...c } : null;
}

module.exports = { COUNTRIES, DEFAULT_COUNTRY, profileOf };
