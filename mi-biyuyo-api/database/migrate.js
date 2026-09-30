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


    // ── v2: entidades, transferencias, ítems y campos nuevos (idempotente) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS entities (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name         VARCHAR(100) NOT NULL,
        kind         VARCHAR(20)  NOT NULL DEFAULT 'banco',
        currency     VARCHAR(3)   NOT NULL DEFAULT 'usd',
        initial_usd  DECIMAL(15,4) NOT NULL DEFAULT 0,
        payment_type VARCHAR(10)  NOT NULL DEFAULT 'none',
        payment_data JSONB        NOT NULL DEFAULT '[]',
        alert_usd    DECIMAL(15,4),
        created_at   TIMESTAMPTZ  DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS transfers (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
        to_entity_id   INTEGER NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
        amount_usd     DECIMAL(15,4) NOT NULL,
        fee_usd        DECIMAL(15,4) NOT NULL DEFAULT 0,
        currency       VARCHAR(10)   NOT NULL DEFAULT 'USD',
        date           DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id             SERIAL PRIMARY KEY,
        transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        name           VARCHAR(100) NOT NULL,
        amount_usd     DECIMAL(15,4)
      )
    `);
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS code VARCHAR(30)`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cash BOOLEAN NOT NULL DEFAULT TRUE`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS due_date DATE`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_name VARCHAR(120)`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_data TEXT`);
    await client.query(`ALTER TABLE transaction_payments ADD COLUMN IF NOT EXISTS entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE transaction_payments ADD COLUMN IF NOT EXISTS rate DECIMAL(15,4)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_entities_user ON entities(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transfers_user ON transfers(user_id, date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_items_transaction ON transaction_items(transaction_id)`);


    // ── v3: valores históricos (tasa del día) y saldo inicial en la moneda de la entidad ──
    await client.query(`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS amount_ves DECIMAL(15,4)`);
    await client.query(`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS amount_binance DECIMAL(15,4)`);
    await client.query(`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS fee_ves DECIMAL(15,4)`);
    await client.query(`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS fee_binance DECIMAL(15,4)`);
    await client.query(`ALTER TABLE entities ADD COLUMN IF NOT EXISTS initial_amount DECIMAL(15,4)`);
    // Relleno de datos anteriores con la tasa vigente del usuario (aproximación única)
    await client.query(`
      UPDATE transfers t SET
        amount_ves     = COALESCE(t.amount_ves,     t.amount_usd * r.usd_to_ves),
        fee_ves        = COALESCE(t.fee_ves,        t.fee_usd    * r.usd_to_ves),
        amount_binance = COALESCE(t.amount_binance, CASE WHEN r.binance_to_ves > 0 THEN t.amount_usd * r.usd_to_ves / r.binance_to_ves END),
        fee_binance    = COALESCE(t.fee_binance,    CASE WHEN r.binance_to_ves > 0 THEN t.fee_usd    * r.usd_to_ves / r.binance_to_ves END)
      FROM exchange_rates r
      WHERE r.user_id = t.user_id AND (t.amount_ves IS NULL OR t.fee_ves IS NULL)
    `);
    await client.query(`
      UPDATE entities e SET initial_amount = CASE WHEN e.currency = 'usd' THEN e.initial_usd
                                                   ELSE e.initial_usd * COALESCE(
                                                     (SELECT usd_to_ves FROM exchange_rates r WHERE r.user_id = e.user_id), 0) END
      WHERE e.initial_amount IS NULL
    `);


    // ── v4: corrige valores USDT guardados con la fórmula anterior (Binance como bolívares) ──
    // Señal: amount_binance > 5 × amount_usd (con la fórmula correcta ronda 1×). Se reconstruyen
    // las tasas del día con los propios valores guardados; es idempotente.
    for (const tbl of ["transactions", "transaction_payments"]) {
      // Registros en USD o VES: solo estaba mal amount_binance
      await client.query(`
        UPDATE ${tbl} SET amount_binance = amount_ves * amount_usd / amount_binance
        WHERE currency <> 'BINANCE' AND amount_usd > 0 AND amount_ves > 0
          AND amount_binance > amount_usd * 5
      `);
      // Registros en USDT: también estaba mal el valor en USD y en VES
      await client.query(`
        UPDATE ${tbl} SET
          amount_usd     = amount * amount / amount_ves,
          amount_ves     = amount * amount / amount_usd,
          amount_binance = amount
        WHERE currency = 'BINANCE' AND amount_usd > 0 AND amount_ves > 0
          AND amount_binance > amount_usd * 5
      `);
    }
    await client.query(`
      UPDATE transaction_payments SET rate = amount_binance / amount_usd
      WHERE currency = 'BINANCE' AND amount_usd > 0 AND rate > 5
    `);


    // ── v5: entidades que no suman a "Mi saldo" ──
    await client.query(`ALTER TABLE entities ADD COLUMN IF NOT EXISTS include_in_balance BOOLEAN NOT NULL DEFAULT TRUE`);


    // ── v6: entidades en USDT (la columna currency admitía solo 3 caracteres) ──
    await client.query(`ALTER TABLE entities ALTER COLUMN currency TYPE VARCHAR(10)`);

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
