// Pone a un usuario de la base LOCAL en un estado de plan, para probar la app (Expo Go) sin esperar.
//   npm run plan:set -- correo@ejemplo.com trial [días]
// Estados:
//   none             sin datos de plan (como un usuario anterior a la función: recibe su prueba al entrar)
//   trial [días]     en prueba; quedan N días (por defecto 14)
//   free             prueba terminada y sin Premium (plan Gratis)
//   premium [días]   Premium vigente; quedan N días (por defecto 30)
//   premium-vence    Premium que vence en 2 días (para el aviso de Inicio)
//   premium-vencido  Premium que venció ayer y prueba terminada (pasa a Gratis)
require("../src/config/loadEnv");
const pool = require("../src/config/database");

if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)) {
  console.log("ABORTO: la base no es local (" + process.env.DB_HOST + ")");
  process.exit(1);
}

const [email, state, daysArg] = process.argv.slice(2);
const days = Number.isInteger(Number(daysArg)) && daysArg !== undefined ? Number(daysArg) : null;
const interval = (n) => `INTERVAL '${Math.trunc(n)} days'`;

const SETS = {
  none: () => `trial_days_granted = NULL, trial_ends_at = NULL, premium_until = NULL`,
  trial: () => `trial_days_granted = 14, trial_ends_at = NOW() + ${interval(days ?? 14)}, premium_until = NULL`,
  free: () => `trial_days_granted = 14, trial_ends_at = NOW() - INTERVAL '2 days', premium_until = NULL`,
  premium: () => `trial_days_granted = 14, trial_ends_at = NOW() - INTERVAL '30 days', premium_until = NOW() + ${interval(days ?? 30)}`,
  "premium-vence": () => `trial_days_granted = 14, trial_ends_at = NOW() - INTERVAL '30 days', premium_until = NOW() + INTERVAL '2 days'`,
  "premium-vencido": () => `trial_days_granted = 14, trial_ends_at = NOW() - INTERVAL '40 days', premium_until = NOW() - INTERVAL '1 day'`,
};

if (!email || !SETS[state]) {
  console.log("Uso: npm run plan:set -- <correo> <" + Object.keys(SETS).join("|") + "> [días]");
  process.exit(1);
}

pool
  .query(
    `UPDATE users SET ${SETS[state]()}, expiry_notice_for = NULL, trial_notice_for = NULL, updated_at = NOW()
     WHERE email = $1 RETURNING email, trial_ends_at, premium_until`,
    [email.toLowerCase()],
  )
  .then((r) => {
    if (!r.rowCount) return console.log("No hay un usuario con ese correo");
    const u = r.rows[0];
    console.log(`✔ ${u.email} → ${state}`);
    console.log("  prueba hasta:", u.trial_ends_at ? u.trial_ends_at.toISOString() : "—");
    console.log("  premium hasta:", u.premium_until ? u.premium_until.toISOString() : "—");
  })
  .finally(() => pool.end());
