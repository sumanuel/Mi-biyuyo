require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/database");
const { body } = require("express-validator");
const { sendMail, mailConfigured } = require("../utils/mailer");
const { DEFAULT_COUNTRY, profileOf } = require("../config/countries");

const SALT_ROUNDS = 12;

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

const CODE_MINUTES = 15;
const CODE_MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

const hashCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

function httpError(status, message, extra) {
  const err = new Error(message);
  err.status = status;
  if (extra) err.extra = extra;
  return err;
}

const MAILS = {
  verify: {
    subject: "Tu código de verificación — Mi Biyuyo",
    intro: "Tu código para verificar tu correo en Mi Biyuyo es:",
    outro: "Si no creaste una cuenta, ignora este correo.",
    text: (code) => `Tu código de verificación es ${code}.`,
  },
  reset: {
    subject: "Código para restablecer tu contraseña — Mi Biyuyo",
    intro: "Tu código para restablecer tu contraseña de Mi Biyuyo es:",
    outro:
      "Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.",
    text: (code) => `Tu código para restablecer la contraseña es ${code}.`,
  },
};

/**
 * Crea y envía un código de 6 dígitos (purpose: 'verify' o 'reset').
 * Respeta un intervalo mínimo entre envíos. Devuelve { devCode } solo si el
 * correo no está configurado y el servidor no está en producción.
 */
async function issueCode(user, purpose) {
  const { rows: last } = await pool.query(
    `SELECT created_at FROM email_verification_codes
     WHERE user_id = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1`,
    [user.id, purpose],
  );
  if (last.length) {
    const wait =
      RESEND_SECONDS - (Date.now() - new Date(last[0].created_at)) / 1000;
    if (wait > 0)
      throw httpError(
        429,
        `Espera ${Math.ceil(wait)} segundos para pedir otro código`,
        { retry_after: Math.ceil(wait) },
      );
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await pool.query(
    `UPDATE email_verification_codes SET used_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [user.id, purpose],
  );
  await pool.query(
    `INSERT INTO email_verification_codes (user_id, code_hash, expires_at, purpose) VALUES ($1, $2, $3, $4)`,
    [
      user.id,
      hashCode(code),
      new Date(Date.now() + CODE_MINUTES * 60000),
      purpose,
    ],
  );
  const m = MAILS[purpose];
  try {
    await sendMail({
      to: user.email,
      subject: m.subject,
      text: `${m.text(code)} Vence en ${CODE_MINUTES} minutos.`,
      html: `<p>Hola ${user.name || ""},</p>
             <p>${m.intro}</p>
             <p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p>
             <p>Vence en ${CODE_MINUTES} minutos. ${m.outro}</p>`,
    });
  } catch (mailErr) {
    console.error("Error enviando código:", mailErr.message);
  }
  const showDev = !mailConfigured() && process.env.NODE_ENV !== "production";
  return { devCode: showDev ? code : undefined };
}

const issueVerificationCode = (user) => issueCode(user, "verify");

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    // Sin país (apps anteriores) se asume Venezuela
    const profile = profileOf(req.body.country || DEFAULT_COUNTRY);
    if (!profile) return res.status(422).json({ error: "País no disponible" });
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (rows.length)
      return res.status(409).json({ error: "El correo ya está registrado" });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const colors = [
      "#4361EE",
      "#22C55E",
      "#F59E0B",
      "#EF4444",
      "#6C7FFF",
      "#EC4899",
    ];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const { rows: userRows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, avatar_color, email_verified, country, mode, base_currency) VALUES ($1, $2, $3, $4, false, $5, $6, $7) RETURNING id, name, email`,
      [
        name.trim(),
        email.toLowerCase(),
        hash,
        avatarColor,
        profile.country,
        profile.mode,
        profile.currency,
      ],
    );
    const user = userRows[0];

    // Solo Venezuela (modo multi) usa tasas de cambio
    if (profile.mode === "multi")
      await pool.query(
        `INSERT INTO exchange_rates (user_id, usd_to_ves, binance_to_ves, source) VALUES ($1, 0, 0, 'manual')`,
        [user.id],
      );

    const { devCode } = await issueVerificationCode(user);
    res.status(201).json({
      needs_verification: true,
      email: user.email,
      dev_code: devCode,
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, avatar_color, theme_preference, email_verified, country, mode, base_currency FROM users WHERE email = $1`,
      [email.toLowerCase()],
    );
    if (!rows.length)
      return res.status(401).json({ error: "Credenciales incorrectas" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Credenciales incorrectas" });

    if (!user.email_verified) {
      let devCode;
      try {
        ({ devCode } = await issueVerificationCode(user));
      } catch (e) {
        if (e.status !== 429) throw e; // ya se envió uno hace poco
      }
      return res.status(403).json({
        error: "Debes verificar tu correo para entrar",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
        dev_code: devCode,
      });
    }

    delete user.password_hash;
    delete user.email_verified;
    res.json({ token: signToken(user.id), user });
  } catch (err) {
    next(err);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const { rows: users } = await pool.query(
      `SELECT id, name, email, avatar_color, theme_preference, email_verified, country, mode, base_currency FROM users WHERE email = $1`,
      [email.toLowerCase()],
    );
    const invalid = httpError(400, "Código incorrecto o vencido");
    if (!users.length) throw invalid;
    const user = users[0];

    if (!user.email_verified) {
      const { rows } = await pool.query(
        `SELECT id, code_hash, attempts FROM email_verification_codes
         WHERE user_id = $1 AND purpose = 'verify' AND used_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [user.id],
      );
      if (!rows.length) throw invalid;
      const row = rows[0];
      if (row.attempts >= CODE_MAX_ATTEMPTS)
        throw httpError(
          429,
          "Demasiados intentos. Pide un código nuevo para continuar",
        );
      if (row.code_hash !== hashCode(String(code).trim())) {
        await pool.query(
          `UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`,
          [row.id],
        );
        throw invalid;
      }
      await pool.query(
        `UPDATE email_verification_codes SET used_at = NOW() WHERE id = $1`,
        [row.id],
      );
      await pool.query(
        `UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1`,
        [user.id],
      );
    }

    delete user.email_verified;
    res.json({ token: signToken(user.id), user });
  } catch (err) {
    next(err);
  }
};

exports.resendCode = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, email_verified FROM users WHERE email = $1`,
      [req.body.email.toLowerCase()],
    );
    const generic = { message: "Si el correo existe recibirás un código" };
    if (!rows.length || rows[0].email_verified) return res.json(generic);
    const { devCode } = await issueVerificationCode(rows[0]);
    res.json({ ...generic, dev_code: devCode });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, avatar_color, theme_preference, country, mode, base_currency, created_at FROM users WHERE id = $1`,
      [req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, theme_preference } = req.body;
    const { rows } = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), theme_preference = COALESCE($2, theme_preference), updated_at = NOW()
       WHERE id = $3 RETURNING id, name, email, avatar_color, theme_preference, country, mode, base_currency`,
      [name || null, theme_preference || null, req.user.id],
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// Recuperar contraseña con un código enviado al correo.
// Siempre responde igual, exista o no el correo, para no revelar qué cuentas existen.
exports.forgotPassword = async (req, res, next) => {
  try {
    const generic = { message: "Si el correo existe recibirás un código" };
    const { rows } = await pool.query(
      "SELECT id, name, email FROM users WHERE email = $1",
      [req.body.email.toLowerCase()],
    );
    if (!rows.length) return res.json(generic);
    try {
      const { devCode } = await issueCode(rows[0], "reset");
      return res.json({ ...generic, dev_code: devCode });
    } catch (e) {
      if (e.status !== 429) throw e; // ya se envió uno hace poco
      return res.json({ ...generic, retry_after: e.extra?.retry_after });
    }
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, password } = req.body;
    const invalid = httpError(400, "Código incorrecto o vencido");
    const { rows: users } = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()],
    );
    if (!users.length) throw invalid;
    const userId = users[0].id;

    const { rows } = await pool.query(
      `SELECT id, code_hash, attempts FROM email_verification_codes
       WHERE user_id = $1 AND purpose = 'reset' AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (!rows.length) throw invalid;
    const row = rows[0];
    if (row.attempts >= CODE_MAX_ATTEMPTS)
      throw httpError(
        429,
        "Demasiados intentos. Pide un código nuevo para continuar",
      );
    if (row.code_hash !== hashCode(String(code).trim())) {
      await pool.query(
        `UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1`,
        [row.id],
      );
      throw invalid;
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    // Tener el código del correo prueba que la cuenta es de quien lo pide: queda verificada
    await pool.query(
      `UPDATE users SET password_hash = $1, email_verified = true, updated_at = NOW() WHERE id = $2`,
      [hash, userId],
    );
    await pool.query(
      `UPDATE email_verification_codes SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    next(err);
  }
};

// Validators
exports.validateRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Nombre requerido")
    .isLength({ max: 100 }),
  body("email").isEmail().withMessage("Correo inválido").normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("La contraseña debe tener al menos 6 caracteres"),
  body("country").optional().isString().isLength({ min: 2, max: 2 }),
];

exports.validateLogin = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

exports.validateVerifyEmail = [
  body("email").isEmail().normalizeEmail(),
  body("code").trim().isLength({ min: 6, max: 6 }).isNumeric(),
];

exports.validateResendCode = [body("email").isEmail().normalizeEmail()];

exports.validateForgotPassword = [body("email").isEmail().normalizeEmail()];

exports.validateResetPassword = [
  body("email").isEmail().normalizeEmail(),
  body("code").trim().isLength({ min: 6, max: 6 }).isNumeric(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("La contraseña debe tener al menos 6 caracteres"),
];
