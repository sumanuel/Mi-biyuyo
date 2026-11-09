const crypto = require("crypto");
const { makeLimiter } = require("../utils/throttle");

// 10 claves incorrectas desde la misma IP bloquean los intentos durante 15 minutos
const wrongKeys = makeLimiter(10, 15 * 60 * 1000);

/** La clave de administración debe existir y tener al menos 16 caracteres; si no, no hay panel. */
const adminKey = () => {
  const k = process.env.ADMIN_KEY || "";
  return k.length >= 16 ? k : null;
};
const adminEnabled = () => adminKey() !== null;

/**
 * Protege /api/admin con la cabecera `x-admin-key`. Sin ADMIN_KEY configurada el panel no existe
 * (404). La comparación es de tiempo constante y los intentos fallidos se limitan.
 */
function adminGuard(req, res, next) {
  const key = adminKey();
  if (!key) return res.status(404).json({ error: "No encontrado" });

  const wait = wrongKeys.blockedFor(req.ip);
  if (wait)
    return res
      .status(429)
      .json({ error: "Demasiados intentos. Espera unos minutos", retry_after: wait });

  const given = Buffer.from(String(req.headers["x-admin-key"] || ""));
  const real = Buffer.from(key);
  const ok = given.length === real.length && crypto.timingSafeEqual(given, real);
  if (!ok) {
    wrongKeys.fail(req.ip);
    return res.status(401).json({ error: "Clave incorrecta" });
  }
  wrongKeys.clear(req.ip);
  next();
}

module.exports = adminGuard;
module.exports.adminEnabled = adminEnabled;
