const axios = require("axios");
const pool = require("../config/database");

/**
 * Tasa BCV oficial (VES por 1 USD) que usa el servidor para calcular lo que se paga en bolívares.
 * No se usa la tasa que el usuario tiene guardada: la puede escribir a mano y pagaría de menos.
 *  1. Si el administrador fijó `bcv_rate_override` (app_settings), se usa esa.
 *  2. Si no, la de DolarApi (oficial), guardada una hora en memoria.
 *  3. Si falla la consulta, la última obtenida; si nunca se obtuvo, null.
 */
const DOLARAPI = "https://ve.dolarapi.com/v1/dolares";
const CACHE_MS = 60 * 60 * 1000;
let cache = { rate: 0, at: 0 };

async function fetchOfficial() {
  const { data } = await axios.get(DOLARAPI, { timeout: 8000 });
  const item = (Array.isArray(data) ? data : []).find((d) => d.fuente === "oficial");
  const price = parseFloat(item?.promedio);
  if (!(price > 0)) throw new Error("dolarapi sin dato oficial");
  return price;
}

/** → { rate, source: 'manual' | 'auto' } o null si no hay tasa. */
async function getBcvRate() {
  const { rows } = await pool.query(
    `SELECT value FROM app_settings WHERE key = 'bcv_rate_override'`,
  );
  const manual = parseFloat(rows[0]?.value);
  if (manual > 0) return { rate: manual, source: "manual" };

  if (cache.rate > 0 && Date.now() - cache.at < CACHE_MS)
    return { rate: cache.rate, source: "auto" };
  try {
    cache = { rate: await fetchOfficial(), at: Date.now() };
  } catch {
    // sin conexión: se usa la última tasa conocida, aunque sea vieja
  }
  return cache.rate > 0 ? { rate: cache.rate, source: "auto" } : null;
}

module.exports = { getBcvRate };
