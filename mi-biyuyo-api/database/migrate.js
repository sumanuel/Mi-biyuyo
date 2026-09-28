require("dotenv").config();
const pool = require("../src/config/database");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_color  VARCHAR(7)   DEFAULT '#4361EE',
        theme_preference VARCHAR(10) DEFAULT 'light',
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        usd_to_ves      DECIMAL(15,4) NOT NULL DEFAULT 0,
        binance_to_ves  DECIMAL(15,4) NOT NULL DEFAULT 0,
        source          VARCHAR(20) DEFAULT 'manual',
        fetched_at      TIMESTAMPTZ,
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name       VARCHAR(100) NOT NULL,
        type       VARCHAR(20)  NOT NULL,
        macro_type VARCHAR(20),
        icon       VARCHAR(50)  DEFAULT 'ellipse',
        color      VARCHAR(7)   DEFAULT '#4361EE',
        parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        is_default BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        active     BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        amount           DECIMAL(15,2) NOT NULL,
        currency         VARCHAR(10)   NOT NULL,
        amount_usd       DECIMAL(15,4),
        amount_ves       DECIMAL(15,4),
        amount_binance   DECIMAL(15,4),
        description      VARCHAR(255),
        date             DATE NOT NULL DEFAULT CURRENT_DATE,
        counterpart_name VARCHAR(100),
        status           VARCHAR(20) DEFAULT 'active',
        notes            TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transaction_payments (
        id             SERIAL PRIMARY KEY,
        transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        amount         DECIMAL(15,2) NOT NULL,
        currency       VARCHAR(10)   NOT NULL,
        amount_usd     DECIMAL(15,4),
        amount_ves     DECIMAL(15,4),
        amount_binance DECIMAL(15,4),
        date           DATE NOT NULL DEFAULT CURRENT_DATE,
        notes          VARCHAR(255),
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at    TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes for common queries
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_transactions_user_date    ON transactions(user_id, date DESC)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_transactions_user_status  ON transactions(user_id, status)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_categories_user_type      ON categories(user_id, type)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_payments_transaction      ON transaction_payments(transaction_id)`,
    );

    await client.query("COMMIT");
    console.log("✅ Migración completada");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error en migración:", err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
