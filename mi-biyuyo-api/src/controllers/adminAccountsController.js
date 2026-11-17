const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../config/database");
const { makeLimiter } = require("../utils/throttle");
const { sendMail, mailConfigured, maskEmail } = require("../utils/mailer");
const guard = require("../middleware/adminGuard");

/**
 * Cuentas de administrador. Se dan de alta SIN contraseña (en el panel o directo en la base):
 * cada persona crea la suya con un código de 6 dígitos que llega a su correo, y la recupera igual.
 */

// Intentos de inicio de sesión fallidos por correo (además del límite por IP del guard)
const wrongLogins = makeLimiter(8, 15 * 60 * 1000);
// Pedidos de código: por IP y por correo (cada pedido cuenta, se pida o no a un administrador real)
const codeByIp = makeLimiter(20, 60 * 60 * 1000);
const codeByEmail = makeLimiter(6, 60 * 60 * 1000);
// Códigos incorrectos al definir la contraseña (aparte del login: cada código ya admite solo 5 intentos)
const badCodeIp = makeLimiter(30, 15 * 60 * 1000);
const badCodeEmail = makeLimiter(12, 15 * 60 * 1000);

const MIN_PASSWORD = 10;
const COST = 12;
const CODE_MINUTES = 15;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_SECONDS = 60;
// Hash de relleno: se compara aunque el correo no exista, para que no se note la diferencia en el tiempo
const DUMMY_HASH = bcrypt.hashSync("relleno-no-valido", 8);

const fail = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};
const emailOf = (v) => String(v || "").trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

function checkPassword(p) {
  const s = String(p || "");
  if (s.length < MIN_PASSWORD)
    throw fail(422, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
  if (s.length > 72) throw fail(422, "La contraseña no puede superar 72 caracteres");
  return s;
}

/** ¿Quedaría alguna vía de acceso si `exceptId` deja de estar activa? */
async function wouldLockOut(exceptId) {
  if (guard.adminKey()) return false; // la clave de emergencia siempre permite volver a entrar
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM admin_users WHERE active AND id <> $1`,
    [exceptId],
  );
  return rows[0].n === 0;
}

const sessionOf = (a) => ({
  token: guard.signSession(a),
  email: a.email,
  name: a.name,
  expires_in_hours: guard.SESSION_HOURS,
});

/**
 * Genera y envía el código de 6 dígitos (se guarda con hash; vence en 15 minutos y sirve una vez).
 * Devuelve el código solo en desarrollo sin correo configurado (para poder probar).
 */
async function sendAccessCode(a) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await pool.query(
    `UPDATE admin_users SET reset_code_hash = $2, reset_expires_at = $3, reset_attempts = 0,
            reset_sent_at = NOW() WHERE id = $1`,
    [a.id, await bcrypt.hash(code, 8), new Date(Date.now() + CODE_MINUTES * 60000)],
  );
  try {
    await sendMail({
      to: a.email,
      subject: "Tu código para el panel de Mi Biyuyo",
      text: `Tu código para crear o recuperar tu contraseña del panel de administración es ${code}. Vence en ${CODE_MINUTES} minutos. Si no lo pediste, ignora este mensaje.`,
      html: `<p>Hola ${esc(a.name)},</p>
             <p>Tu código para crear o recuperar tu contraseña del panel de administración:</p>
             <p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p>
             <p>Vence en ${CODE_MINUTES} minutos y sirve una sola vez. Si no lo pediste, ignora este mensaje.</p>`,
    });
  } catch (mailErr) {
    console.error(
      `[Correo] No se pudo enviar el código de administración a ${maskEmail(a.email)}:`,
      mailErr.code || "",
      mailErr.message,
    );
  }
  return !mailConfigured() && process.env.NODE_ENV !== "production" ? code : undefined;
}

exports.login = async (req, res, next) => {
  try {
    if (!(await guard.adminAvailable()))
      return res.status(404).json({ error: "No encontrado" });
    if (!guard.sessionSecret())
      throw fail(503, "Falta JWT_SECRET (mínimo 16 caracteres) en el servidor");
    const email = emailOf(req.body?.email);
    const password = String(req.body?.password || "");
    const wait = Math.max(
      guard.wrongKeys.blockedFor(req.ip),
      wrongLogins.blockedFor(email),
    );
    if (wait)
      return res
        .status(429)
        .json({ error: "Demasiados intentos. Espera unos minutos", retry_after: wait });

    const { rows } = await pool.query(
      `SELECT id, email, name, password_hash, active FROM admin_users WHERE email = $1`,
      [email],
    );
    const a = rows[0];
    // Una cuenta sin contraseña todavía no puede entrar con contraseña (usa el código del correo)
    const match = await bcrypt.compare(
      password,
      a && a.password_hash ? a.password_hash : DUMMY_HASH,
    );
    if (!a || !a.active || !a.password_hash || !match) {
      guard.wrongKeys.fail(req.ip);
      wrongLogins.fail(email);
      guard.logAdmin(email || "(vacío)", "LOGIN", "correo o contraseña incorrectos", req.ip, false);
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }
    guard.wrongKeys.clear(req.ip);
    wrongLogins.clear(email);
    await pool.query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`, [a.id]);
    guard.logAdmin(a.email, "LOGIN", null, req.ip, true);
    res.json(sessionOf(a));
  } catch (err) {
    next(err);
  }
};

// Pide el código (primer ingreso o contraseña olvidada). Responde siempre lo mismo.
exports.requestCode = async (req, res, next) => {
  try {
    if (!(await guard.adminAvailable()))
      return res.status(404).json({ error: "No encontrado" });
    const email = emailOf(req.body?.email);
    const wait = Math.max(codeByIp.blockedFor(req.ip), codeByEmail.blockedFor(email));
    if (wait)
      return res
        .status(429)
        .json({ error: "Demasiados intentos. Espera unos minutos", retry_after: wait });
    codeByIp.fail(req.ip);
    codeByEmail.fail(email);

    const generic = {
      message: `Si el correo es de un administrador, te enviamos un código. Vence en ${CODE_MINUTES} minutos.`,
    };
    const { rows } = await pool.query(
      `SELECT id, email, name, reset_sent_at FROM admin_users WHERE email = $1 AND active`,
      [email],
    );
    const a = rows[0];
    if (!a) return res.json(generic);
    // Reenvíos demasiado seguidos se ignoran en silencio (el código anterior sigue válido)
    if (a.reset_sent_at && Date.now() - new Date(a.reset_sent_at).getTime() < RESEND_SECONDS * 1000)
      return res.json(generic);
    const devCode = await sendAccessCode(a);
    guard.logAdmin(a.email, "PASSWORD_CODE_REQUEST", null, req.ip, true);
    res.json({ ...generic, dev_code: devCode });
  } catch (err) {
    next(err);
  }
};

// Con el código del correo se define la contraseña y se entra
exports.resetPassword = async (req, res, next) => {
  try {
    if (!(await guard.adminAvailable()))
      return res.status(404).json({ error: "No encontrado" });
    if (!guard.sessionSecret())
      throw fail(503, "Falta JWT_SECRET (mínimo 16 caracteres) en el servidor");
    const email = emailOf(req.body?.email);
    const code = String(req.body?.code || "").trim();
    const wait = Math.max(badCodeIp.blockedFor(req.ip), badCodeEmail.blockedFor(email));
    if (wait)
      return res
        .status(429)
        .json({ error: "Demasiados intentos. Espera unos minutos", retry_after: wait });
    const password = checkPassword(req.body?.password);

    const bad = () => {
      badCodeIp.fail(req.ip);
      badCodeEmail.fail(email);
      return res.status(400).json({ error: "Código inválido o vencido" });
    };
    const { rows } = await pool.query(
      `SELECT id, email, name, reset_code_hash, reset_expires_at, reset_attempts
       FROM admin_users WHERE email = $1 AND active`,
      [email],
    );
    const a = rows[0];
    if (
      !a ||
      !a.reset_code_hash ||
      new Date(a.reset_expires_at) < new Date() ||
      a.reset_attempts >= MAX_CODE_ATTEMPTS
    ) {
      await bcrypt.compare(code, DUMMY_HASH); // mismo tiempo de respuesta
      guard.logAdmin(email || "(vacío)", "PASSWORD_RESET", "código inválido o vencido", req.ip, false);
      return bad();
    }
    if (!/^\d{6}$/.test(code) || !(await bcrypt.compare(code, a.reset_code_hash))) {
      await pool.query(`UPDATE admin_users SET reset_attempts = reset_attempts + 1 WHERE id = $1`, [a.id]);
      guard.logAdmin(a.email, "PASSWORD_RESET", "código incorrecto", req.ip, false);
      return bad();
    }
    await pool.query(
      `UPDATE admin_users SET password_hash = $2, password_changed_at = NOW(), last_login_at = NOW(),
              reset_code_hash = NULL, reset_expires_at = NULL, reset_attempts = 0
       WHERE id = $1`,
      [a.id, await bcrypt.hash(password, COST)],
    );
    badCodeIp.clear(req.ip);
    badCodeEmail.clear(email);
    guard.logAdmin(a.email, "PASSWORD_RESET", "contraseña definida", req.ip, true);
    res.json(sessionOf(a));
  } catch (err) {
    next(err);
  }
};

exports.me = (req, res) => {
  res.json({ email: req.admin.email, name: req.admin.name, via: req.admin.via });
};

exports.changeMyPassword = async (req, res, next) => {
  try {
    if (req.admin.via !== "cuenta")
      throw fail(422, "Con la clave de emergencia no hay contraseña que cambiar");
    const nueva = checkPassword(req.body?.password);
    const { rows } = await pool.query(
      `SELECT password_hash FROM admin_users WHERE id = $1`,
      [req.admin.id],
    );
    if (
      !rows.length ||
      !rows[0].password_hash ||
      !(await bcrypt.compare(String(req.body?.current || ""), rows[0].password_hash))
    )
      throw fail(401, "La contraseña actual no es correcta");
    await pool.query(
      `UPDATE admin_users SET password_hash = $2, password_changed_at = NOW() WHERE id = $1`,
      [req.admin.id, await bcrypt.hash(nueva, COST)],
    );
    // Las demás sesiones se cierran; esta sigue con una sesión nueva
    res.json({ message: "Contraseña actualizada", ...sessionOf(req.admin) });
  } catch (err) {
    next(err);
  }
};

const COLS = `id, email, name, active, (password_hash IS NOT NULL) AS has_password,
              created_at, last_login_at, created_by`;

exports.list = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLS} FROM admin_users ORDER BY email`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// Alta sin contraseña: la persona la crea con el código que le llega al correo
exports.create = async (req, res, next) => {
  try {
    const email = emailOf(req.body?.email);
    const name = String(req.body?.name || "").trim().slice(0, 100);
    if (!EMAIL_RE.test(email) || email.length > 255) throw fail(422, "Correo inválido");
    if (!name) throw fail(422, "Escribe el nombre");
    try {
      const { rows } = await pool.query(
        `INSERT INTO admin_users (email, name, created_by) VALUES ($1,$2,$3) RETURNING ${COLS}`,
        [email, name, req.admin.email],
      );
      guard.resetAccountsCache();
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === "23505") throw fail(409, "Ya existe un administrador con ese correo");
      throw e;
    }
  } catch (err) {
    next(err);
  }
};

// Envía a un administrador su código de acceso (para el primer ingreso o si perdió la contraseña)
exports.invite = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT id, email, name, active FROM admin_users WHERE id = $1`,
      [id],
    );
    if (!rows.length) throw fail(404, "Administrador no encontrado");
    if (!rows[0].active) throw fail(409, "La cuenta está desactivada");
    const devCode = await sendAccessCode(rows[0]);
    res.json({
      message: mailConfigured()
        ? `Código enviado a ${maskEmail(rows[0].email)}`
        : "El correo no está configurado en el servidor: no se pudo enviar",
      dev_code: devCode,
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows: cur } = await pool.query(
      `SELECT id, active FROM admin_users WHERE id = $1`,
      [id],
    );
    if (!cur.length) throw fail(404, "Administrador no encontrado");
    const b = req.body || {};
    if (b.password !== undefined)
      throw fail(422, "Las contraseñas las crea cada administrador con el código de su correo");
    const sets = [];
    const vals = [id];
    if (b.name !== undefined) {
      const name = String(b.name || "").trim().slice(0, 100);
      if (!name) throw fail(422, "Escribe el nombre");
      vals.push(name);
      sets.push(`name = $${vals.length}`);
    }
    if (b.active !== undefined) {
      const active = b.active === true;
      if (!active && req.admin.id === id)
        throw fail(409, "No puedes desactivar tu propia cuenta");
      if (!active && (await wouldLockOut(id)))
        throw fail(409, "Debe quedar al menos un administrador activo");
      vals.push(active);
      sets.push(`active = $${vals.length}`);
    }
    if (!sets.length) throw fail(422, "No hay cambios");
    const { rows } = await pool.query(
      `UPDATE admin_users SET ${sets.join(", ")} WHERE id = $1 RETURNING ${COLS}`,
      vals,
    );
    guard.resetAccountsCache();
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (req.admin.id === id) throw fail(409, "No puedes eliminar tu propia cuenta");
    if (await wouldLockOut(id))
      throw fail(409, "Debe quedar al menos un administrador activo");
    const { rowCount } = await pool.query(`DELETE FROM admin_users WHERE id = $1`, [id]);
    if (!rowCount) throw fail(404, "Administrador no encontrado");
    guard.resetAccountsCache();
    res.json({ message: "Administrador eliminado" });
  } catch (err) {
    next(err);
  }
};

// Registro de actividad, del más reciente al más antiguo, paginado
exports.activity = async (req, res, next) => {
  try {
    const per = Math.min(Math.max(parseInt(req.query.per) || 30, 1), 100);
    const wanted = Math.max(parseInt(req.query.page) || 1, 1);
    const { rows: c } = await pool.query(`SELECT COUNT(*)::int AS n FROM admin_log`);
    const total = c[0].n;
    const pages = Math.max(Math.ceil(total / per), 1);
    const page = Math.min(wanted, pages);
    const { rows } = await pool.query(
      `SELECT id, admin_email, action, detail, ip, ok, created_at FROM admin_log
       ORDER BY id DESC LIMIT ${per} OFFSET ${(page - 1) * per}`,
    );
    res.json({ rows, total, page, pages, per_page: per });
  } catch (err) {
    next(err);
  }
};
