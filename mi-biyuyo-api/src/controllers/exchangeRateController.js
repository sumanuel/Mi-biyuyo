const pool = require("../config/database");
const axios = require("axios");

const SOURCES = {
  BCV: "https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page/bcv",
  BINANCE: "https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page/binance",
  DOLAR_TODAY:
    "https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page/dolartoday",
};

async function fetchRate(source) {
  const url = SOURCES[source];
  if (!url) throw new Error(`Fuente desconocida: ${source}`);
  const { data } = await axios.get(url, { timeout: 8000 });
  // API returns { monitors: { ... } } or { price: number }
  const price =
    data?.price ?? data?.monitors?.usd?.price ?? data?.monitors?.default?.price;
  if (!price) throw new Error("Respuesta de API inesperada");
  return parseFloat(price);
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

    for (const source of ["BCV", "DOLAR_TODAY"]) {
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
