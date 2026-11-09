const pool = require("../config/database");

/**
 * Plan del usuario (Gratis / Prueba / Premium). Ver docs/SUSCRIPCION-PLAN.md.
 * El plan no se guarda como texto: se calcula con users.premium_until y users.trial_ends_at.
 * Con SUBSCRIPTIONS_ENABLED apagado todos son Premium y nada se limita.
 */

const enabled = () => process.env.SUBSCRIPTIONS_ENABLED === "true";

// Funciones que Gratis no tiene (prueba y Premium las tienen todas)
const FEATURES = [
  "multi_entity", // más de 1 entidad activa, archivar y restaurar
  "transfers",
  "debts", // por cobrar / por pagar, abonos, cuotas, recurrentes
  "planned", // gastos planificados
  "custom_categories", // crear, editar y usar categorías propias
  "items", // detalle de la compra
  "receipts", // recibos adjuntos
  "full_stats", // estadísticas completas (solo la app lo aplica, salvo los endpoints del servidor)
  "period_range", // mes anterior, mes específico y rangos de fechas (solo la app lo aplica)
  "export", // Excel (solo la app)
];

const FREE_MAX_ENTITIES = 1;
const MAX_TRIAL_DAYS = 365;

function planError(feature, plan, message) {
  const err = new Error(message || "Esta función es del plan Premium");
  err.status = 402;
  err.extra = { code: "PLAN_REQUIRED", feature, plan };
  return err;
}

/** Valor entero de app_settings acotado a 0..365 (0 = sin prueba); `fallback` si falta o es inválido. */
async function getTrialDays(key, fallback = 14) {
  const { rows } = await pool.query(
    `SELECT value FROM app_settings WHERE key = $1`,
    [key],
  );
  const n = parseInt(rows[0]?.value, 10);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return Math.min(n, MAX_TRIAL_DAYS);
}

/**
 * Empieza la prueba del usuario si aún no la tiene. kind = 'new' (usuario nuevo, al verificar el
 * correo) o 'existing' (usuario anterior a la función, la primera vez que se calcula su plan).
 * Solo actúa con la función encendida; es seguro llamarla varias veces.
 */
async function startTrial(userId, kind = "new") {
  if (!enabled()) return;
  const days = await getTrialDays(
    kind === "existing" ? "trial_days_existing" : "trial_days",
  );
  await pool.query(
    `UPDATE users
     SET trial_days_granted = $2,
         trial_ends_at = NOW() + make_interval(days => $2),
         updated_at = NOW()
     WHERE id = $1 AND trial_days_granted IS NULL`,
    [userId, days],
  );
}

const allFeatures = (value) =>
  Object.fromEntries(FEATURES.map((f) => [f, value]));

/** Plan a partir de las fechas del usuario. */
function planOf(u, now = new Date()) {
  if (u.premium_until && new Date(u.premium_until) > now) return "premium";
  if (u.trial_ends_at && new Date(u.trial_ends_at) > now) return "trial";
  return "free";
}

/**
 * Estado completo del plan del usuario: { enabled, plan, trial_ends_at, premium_until,
 * trial_days_left, features, max_entities, locked_entity_ids }.
 */
async function getPlanState(userId) {
  if (!enabled()) {
    return {
      enabled: false,
      plan: "premium",
      trial_ends_at: null,
      premium_until: null,
      trial_days_left: 0,
      features: allFeatures(true),
      max_entities: null,
      locked_entity_ids: [],
    };
  }

  const read = async () =>
    (
      await pool.query(
        `SELECT trial_ends_at, premium_until, trial_days_granted, email_verified
         FROM users WHERE id = $1`,
        [userId],
      )
    ).rows[0];
  let u = await read();
  if (!u) throw planError("account", "free", "Usuario no encontrado");
  // Usuario anterior a la función: su prueba empieza la primera vez que se calcula su plan
  if (u.trial_days_granted === null && u.email_verified) {
    await startTrial(userId, "existing");
    u = await read();
  }

  const now = new Date();
  const plan = planOf(u, now);
  const paid = plan !== "free";

  // En Gratis solo queda activa la primera entidad (según su orden); el resto es de solo lectura
  let locked = [];
  if (!paid) {
    const { rows } = await pool.query(
      `SELECT id FROM entities WHERE user_id = $1 AND archived_at IS NULL
       ORDER BY COALESCE(sort_order, 1000000), id`,
      [userId],
    );
    locked = rows.slice(FREE_MAX_ENTITIES).map((r) => r.id);
  }

  return {
    enabled: true,
    plan,
    trial_ends_at: u.trial_ends_at,
    premium_until: u.premium_until,
    trial_days_left:
      plan === "trial"
        ? Math.ceil((new Date(u.trial_ends_at) - now) / 86400000)
        : 0,
    features: allFeatures(paid),
    max_entities: paid ? null : FREE_MAX_ENTITIES,
    locked_entity_ids: locked,
  };
}

/** Lanza 402 PLAN_REQUIRED si el plan del estado no incluye la función. */
function need(state, feature) {
  if (!state.features[feature]) throw planError(feature, state.plan);
}

/** Lanza 402 si la entidad quedó bloqueada (solo lectura) por el plan Gratis. */
function needOpenEntity(state, entityId) {
  if (entityId && state.locked_entity_ids.includes(Number(entityId)))
    throw planError(
      "locked_entity",
      state.plan,
      "Esta entidad quedó en solo lectura con el plan Gratis",
    );
}

/** Atajo: calcula el estado y exige la función. Devuelve el estado. */
async function requireFeature(userId, feature) {
  const state = await getPlanState(userId);
  need(state, feature);
  return state;
}

/** Crear una entidad nueva: Gratis solo admite una entidad activa. */
async function requireNewEntity(userId) {
  const state = await getPlanState(userId);
  if (state.max_entities !== null) {
    const { rows } = await pool.query(
      `SELECT count(*)::int n FROM entities WHERE user_id = $1 AND archived_at IS NULL`,
      [userId],
    );
    if (rows[0].n >= state.max_entities)
      throw planError(
        "multi_entity",
        state.plan,
        "El plan Gratis permite una sola entidad",
      );
  }
  return state;
}

/** Planes a la venta (precio y días) para mostrar en la app. */
async function listPlans() {
  const { rows } = await pool.query(
    `SELECT code, name, price_usd::float AS price_usd, days
     FROM subscription_plans WHERE active = TRUE ORDER BY sort_order, code`,
  );
  return rows;
}

module.exports = {
  FEATURES,
  enabled,
  planOf,
  getPlanState,
  startTrial,
  need,
  needOpenEntity,
  requireFeature,
  requireNewEntity,
  listPlans,
  getTrialDays,
};
