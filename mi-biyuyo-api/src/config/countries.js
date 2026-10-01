/**
 * Países disponibles. El país se elige al registrarse y no cambia.
 *  - mode "multi"  (Venezuela): USD como base, con equivalencia en VES (tasa BCV) y USDT (Binance).
 *  - mode "single" (resto): una sola moneda, la del país; sin equivalencias ni tasas.
 *
 * En modo "single" la moneda del país se guarda en las columnas existentes (amount_usd,
 * currency = "USD") como "monto en moneda base": así no cambian el esquema ni los cálculos.
 */
const COUNTRIES = {
  VE: { name: "Venezuela", mode: "multi", currency: "USD" },
  CO: { name: "Colombia", mode: "single", currency: "COP" },
  MX: { name: "México", mode: "single", currency: "MXN" },
  PE: { name: "Perú", mode: "single", currency: "PEN" },
  CL: { name: "Chile", mode: "single", currency: "CLP" },
  AR: { name: "Argentina", mode: "single", currency: "ARS" },
  EC: { name: "Ecuador", mode: "single", currency: "USD" },
  DO: { name: "República Dominicana", mode: "single", currency: "DOP" },
  ES: { name: "España", mode: "single", currency: "EUR" },
  US: { name: "Estados Unidos", mode: "single", currency: "USD" },
};

const DEFAULT_COUNTRY = "VE";

/** Perfil del país (o el de Venezuela si el código no existe). */
function profileOf(code) {
  const c = COUNTRIES[String(code || "").toUpperCase()];
  return c ? { country: String(code).toUpperCase(), ...c } : null;
}

module.exports = { COUNTRIES, DEFAULT_COUNTRY, profileOf };
