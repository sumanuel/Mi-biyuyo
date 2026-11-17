const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { makeLimiter } = require("../utils/throttle");

// 10 intentos incorrectos desde la misma IP bloquean los intentos durante 15 minutos
const wrongKeys = makeLimiter(10, 15 * 60 * 1000);

/**
 * El panel se protege de dos maneras:
 *  - Cuenta de administrador (correo + contraseña guardada con hash en admin_users): el login entrega
 *    una sesión firmada de 8 horas que se manda como `Authorization: Bearer …`.
 *  - Clave de emergencia ADMIN_KEY (≥ 16 caracteres, en el entorno del servidor) con la cabecera
 *    `x-admin-key`: sirve para crear la primera cuenta y para volver a entrar si se pierde el acceso.
 * Sin ninguna de las dos el panel no existe (404).
 */
const adminKey = () => {
  const k = process.env.ADMIN_KEY || "";
  return k.length >= 16 ? k : null;
};
// La sesión se firma con un secreto distinto al de los usuarios de la app (un token de usuario no sirve aquí)
const sessionSecret = () => {
  const s = process.env.JWT_SECRET || "";
  return s.length >= 16 ? s + ":admin" : null;
};
const SESSION_HOURS = 8;
const signSession = (admin) =>
  jwt.sign({ adm: admin.id, email: admin.email }, sessionSecret(), {
    expiresIn: `${SESSION_HOURS}h`,
  });

// ¿Hay alguna cuenta de administrador activa? (se guarda 15 s para no consultar en cada petición)
let accountsCache = { at: 0, value: false };
async function hasAccounts() {
  if (Date.now() - accountsCache.at < 15000) return accountsCache.value;
  let value = false;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM admin_users WHERE active LIMIT 1`,
    );
    value = rows.length > 0;
  } catch {
    value = false;
  }
  accountsCache = { at: Date.now(), value };
  return value;
}
const resetAccountsCache = () => {
  accountsCache = { at: 0, value: false };
};

/** ¿Existe el panel? (hay clave de emergencia o al menos una cuenta activa) */
const adminAvailable = async () =>
  adminKey() !== null || (sessionSecret() !== null && (await hasAccounts()));
const adminEnabled = () => adminKey() !== null; // solo para el aviso al arrancar

/** Registro de actividad (no debe romper nunca la petición). */
function logAdmin(admin, action, detail, ip, ok = true) {
  pool
    .query(
      `INSERT INTO admin_log (admin_email, action, detail, ip, ok) VALUES ($1,$2,$3,$4,$5)`,
      [admin, String(action).slice(0, 160), detail ? String(detail).slice(0, 500) : null, ip || null, ok],
    )
    .catch(() => {});
}

/**
 * Protege /api/admin. Los intentos fallidos se limitan por IP, la comparación de la clave es de tiempo
 * constante y cada acción que cambia algo (POST, PUT, DELETE) queda en el registro con quién la hizo.
 */
async function adminGuard(req, res, next) {
  try {
    if (!(await adminAvailable()))
      return res.status(404).json({ error: "No encontrado" });

    const wait = wrongKeys.blockedFor(req.ip);
    if (wait)
      return res
        .status(429)
        .json({ error: "Demasiados intentos. Espera unos minutos", retry_after: wait });

    const deny = () => {
      wrongKeys.fail(req.ip);
      return res.status(401).json({ error: "Sesión o clave incorrecta" });
    };

    const auth = String(req.headers.authorization || "");
    if (auth.startsWith("Bearer ")) {
      const secret = sessionSecret();
      if (!secret) return deny();
      let payload;
      try {
        payload = jwt.verify(auth.slice(7), secret);
      } catch {
        return deny();
      }
      // La cuenta debe seguir existiendo y activa: desactivarla corta su sesión al instante
      const { rows } = await pool.query(
        `SELECT id, email, name, password_changed_at FROM admin_users WHERE id = $1 AND active`,
        [payload.adm],
      );
      if (!rows.length) return deny();
      // Cambiar la contraseña cierra las sesiones abiertas antes del cambio
      const changed = rows[0].password_changed_at;
      if (changed && payload.iat < Math.floor(new Date(changed).getTime() / 1000)) return deny();
      req.admin = { id: rows[0].id, email: rows[0].email, name: rows[0].name, via: "cuenta" };
    } else {
      const key = adminKey();
      const given = Buffer.from(String(req.headers["x-admin-key"] || ""));
      const real = Buffer.from(key || "");
      const ok = key && given.length === real.length && crypto.timingSafeEqual(given, real);
      if (!ok) return deny();
      req.admin = { id: null, email: "clave de emergencia", name: "Clave de emergencia", via: "clave" };
    }

    wrongKeys.clear(req.ip);
    if (req.method !== "GET") {
      res.on("finish", () => {
        const path = req.originalUrl.split("?")[0].replace(/^\/api\/admin/, "");
        const who = req.body && typeof req.body.email === "string" ? req.body.email : "";
        logAdmin(req.admin.email, `${req.method} ${path}`, who, req.ip, res.statusCode < 400);
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = adminGuard;
module.exports.adminEnabled = adminEnabled;
module.exports.adminAvailable = adminAvailable;
module.exports.adminKey = adminKey;
module.exports.sessionSecret = sessionSecret;
module.exports.signSession = signSession;
module.exports.resetAccountsCache = resetAccountsCache;
module.exports.logAdmin = logAdmin;
module.exports.wrongKeys = wrongKeys;
module.exports.SESSION_HOURS = SESSION_HOURS;
