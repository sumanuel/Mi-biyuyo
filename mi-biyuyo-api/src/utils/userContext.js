const pool = require("../config/database");

/**
 * Modo del usuario ("multi" = Venezuela con tasas, "single" = una sola moneda)
 * y sus tasas de cambio (en modo "single" siempre vacías).
 */
async function getUserCtx(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT u.mode, r.usd_to_ves, r.binance_to_ves
     FROM users u LEFT JOIN exchange_rates r ON r.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  const row = rows[0] || {};
  const mode = row.mode || "multi";
  return {
    mode,
    rates:
      mode === "single"
        ? { usd_to_ves: 0, binance_to_ves: 0 }
        : {
            usd_to_ves: row.usd_to_ves || 0,
            binance_to_ves: row.binance_to_ves || 0,
          },
  };
}

module.exports = { getUserCtx };
