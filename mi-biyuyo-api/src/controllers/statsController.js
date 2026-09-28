const pool = require("../config/database");

exports.summary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const { rows } = await pool.query(
      `SELECT c.type,
              COUNT(t.id)                      AS count,
              SUM(t.amount_usd)                AS total_usd,
              SUM(t.amount_ves)                AS total_ves,
              SUM(t.amount_binance)            AS total_binance
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1
         AND EXTRACT(MONTH FROM t.date) = $2
         AND EXTRACT(YEAR  FROM t.date) = $3
         AND t.status != 'cancelled'
       GROUP BY c.type`,
      [userId, month, year],
    );

    const byType = {};
    for (const r of rows) byType[r.type] = r;

    // Pending loans and debts (active only)
    const { rows: pendingRows } = await pool.query(
      `SELECT c.type,
              COUNT(t.id)                          AS count,
              SUM(t.amount_usd)                    AS total_usd,
              COALESCE(SUM(tp.amount_usd), 0)      AS paid_usd,
              SUM(t.amount_usd) - COALESCE(SUM(tp.amount_usd),0) AS remaining_usd
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       LEFT JOIN transaction_payments tp ON tp.transaction_id = t.id
       WHERE t.user_id = $1
         AND c.type IN ('loan_given','debt')
         AND t.status = 'active'
       GROUP BY c.type`,
      [userId],
    );

    res.json({
      period: { month, year },
      by_type: byType,
      pending: pendingRows,
    });
  } catch (err) {
    next(err);
  }
};

exports.byCategory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const type = req.query.type;

    let where = `t.user_id = $1 AND EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3 AND t.status != 'cancelled'`;
    const params = [userId, month, year];
    if (type) {
      where += ` AND c.type = $4`;
      params.push(type);
    }

    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.type, c.macro_type, c.icon, c.color,
              COUNT(t.id)       AS count,
              SUM(t.amount_usd) AS total_usd,
              SUM(t.amount_ves) AS total_ves
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE ${where}
       GROUP BY c.id, c.name, c.type, c.macro_type, c.icon, c.color
       ORDER BY total_usd DESC`,
      params,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.trend = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const months = Math.min(parseInt(req.query.months) || 6, 12);

    const { rows } = await pool.query(
      `SELECT
         EXTRACT(YEAR  FROM t.date)::int  AS year,
         EXTRACT(MONTH FROM t.date)::int  AS month,
         c.type,
         SUM(t.amount_usd) AS total_usd,
         SUM(t.amount_ves) AS total_ves
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1
         AND t.date >= (CURRENT_DATE - ($2 || ' months')::interval)
         AND t.status != 'cancelled'
         AND c.type IN ('income', 'expense')
       GROUP BY year, month, c.type
       ORDER BY year, month`,
      [userId, months],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
