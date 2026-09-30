const pool = require("../config/database");
const axios = require("axios");

// Fuentes de tasas (el servicio pydolarvenezuela ya no existe):
//  - BCV: ve.dolarapi.com (oficial)
//  - BINANCE: precio de USDT en Binance P2P (criptoya); respaldo: dólar paralelo de dolarapi
const DOLARAPI = "https://ve.dolarapi.com/v1/dolares";
const CRIPTOYA_BINANCE = "https://criptoya.com/api/binancep2p/USDT/VES/1";

async function fetchDolarApi(fuente) {
  const { data } = await axios.get(DOLARAPI, { timeout: 8000 });
  const item = (Array.isArray(data) ? data : []).find((d) => d.fuente === fuente);
  const price = parseFloat(item?.promedio);
  if (!(price > 0)) throw new Error(`dolarapi sin dato de ${fuente}`);
  return price;
}

async function fetchBinance() {
  try {
    const { data } = await axios.get(CRIPTOYA_BINANCE, { timeout: 8000 });
    const ask = parseFloat(data?.ask);
    const bid = parseFloat(data?.bid);
    const vals = [ask, bid].filter((n) => n > 0);
    if (vals.length) return vals.reduce((a, n) => a + n, 0) / vals.length;
    throw new Error("criptoya sin datos");
  } catch {
    return fetchDolarApi("paralelo");
  }
}

async function fetchRate(source) {
  if (source === "BCV") return fetchDolarApi("oficial");
  if (source === "BINANCE") return fetchBinance();
  throw new Error(`Fuente desconocida: ${source}`);
}

exports.get = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM exchange_rates WHERE user_id = $1`,
      [req.user.id],
    );
    res.json(rows[0] || { usd_to_ves: 0, binance_to_ves: 0, source: "manual" });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { usd_to_ves, binance_to_ves } = req.body;
    if (!usd_to_ves && !binance_to_ves)
      return res.status(422).json({ error: "Al menos una tasa requerida" });

    const { rows } = await pool.query(
      `UPDATE exchange_rates SET
         usd_to_ves     = COALESCE($1, usd_to_ves),
         binance_to_ves = COALESCE($2, binance_to_ves),
         source         = 'manual',
         updated_at     = NOW()
       WHERE user_id = $3 RETURNING *`,
      [usd_to_ves || null, binance_to_ves || null, req.user.id],
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.fetch = async (req, res, next) => {
  try {
    let usdVes = null;
    let binanceVes = null;
    const errors = [];

    for (const source of ["BCV"]) {
      try {
        usdVes = await fetchRate(source);
        break;
      } catch (e) {
        errors.push(`${source}: ${e.message}`);
      }
    }

    try {
      binanceVes = await fetchRate("BINANCE");
    } catch (e) {
      errors.push(`BINANCE: ${e.message}`);
    }

    if (!usdVes && !binanceVes) {
      return res
        .status(502)
        .json({ error: "No se pudo obtener tasas externas", details: errors });
    }

    const { rows } = await pool.query(
      `UPDATE exchange_rates SET
         usd_to_ves     = COALESCE($1, usd_to_ves),
         binance_to_ves = COALESCE($2, binance_to_ves),
         source         = 'auto',
         fetched_at     = NOW(),
         updated_at     = NOW()
       WHERE user_id = $3 RETURNING *`,
      [usdVes, binanceVes, req.user.id],
    );
    res.json({ ...rows[0], fetch_errors: errors });
  } catch (err) {
    next(err);
  }
};
