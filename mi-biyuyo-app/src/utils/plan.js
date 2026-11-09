/**
 * Plan del usuario (Gratis / Prueba / Premium). El servidor decide y aplica las reglas; la app
 * solo muestra candados y avisos. Con la función apagada en el servidor (`enabled: false`) todo
 * está permitido y la app no muestra planes.
 */

/** Funciones que Gratis no tiene, con el texto que ve el usuario. */
export const FEATURE_TEXT = {
  multi_entity: "Más de una entidad",
  transfers: "Transferencias entre entidades",
  debts: "Por cobrar y por pagar",
  planned: "Gastos planificados",
  custom_categories: "Categorías propias",
  items: "Detalle de la compra",
  receipts: "Recibos adjuntos",
  full_stats: "Estadísticas completas",
  export: "Exportar a Excel",
  locked_entity: "Entidades adicionales",
};

/** Lo que incluye cada plan, para la comparación de «Mi plan». */
export const COMPARE_ROWS = [
  { text: "Ingresos y gastos", free: true },
  { text: "1 entidad", free: true },
  { text: "Balance, ahorro y distribución del saldo", free: true },
  { text: "Más de una entidad y transferencias", free: false },
  { text: "Por cobrar y por pagar, con abonos y cuotas", free: false },
  { text: "Gastos planificados", free: false },
  { text: "Categorías propias", free: false },
  { text: "Detalle de la compra y recibos adjuntos", free: false },
  { text: "Estadísticas completas", free: false },
  { text: "Exportar a Excel", free: false },
];

const OPEN = {
  enabled: false,
  plan: "premium",
  name: "Premium",
  trialDaysLeft: 0,
  trialEndsAt: null,
  premiumUntil: null,
  features: {},
  maxEntities: null,
  lockedIds: [],
};

/** Estado del plan tal como lo manda el servidor → forma que usa la app. */
export function normalizePlan(sub) {
  if (!sub || sub.enabled === false) return OPEN;
  const plan = sub.plan || "free";
  return {
    enabled: true,
    plan,
    name:
      plan === "premium"
        ? "Premium"
        : plan === "trial"
          ? "Prueba Premium"
          : "Gratis",
    trialDaysLeft: sub.trial_days_left || 0,
    trialEndsAt: sub.trial_ends_at || null,
    premiumUntil: sub.premium_until || null,
    features: sub.features || {},
    maxEntities: sub.max_entities ?? null,
    lockedIds: sub.locked_entity_ids || [],
  };
}

/** ¿Puede usar la función? Con la función de planes apagada, siempre. */
export const canUse = (plan, feature) =>
  !plan.enabled || !!plan.features[feature];

/** ¿Puede crear otra entidad? (Gratis admite una sola activa) */
export const canAddEntity = (plan, activeCount) =>
  !plan.enabled || plan.maxEntities === null || activeCount < plan.maxEntities;

/** ¿La respuesta del servidor es «función Premium»? (402 PLAN_REQUIRED) */
export const isPlanError = (err) =>
  err?.response?.status === 402 &&
  err?.response?.data?.code === "PLAN_REQUIRED";
