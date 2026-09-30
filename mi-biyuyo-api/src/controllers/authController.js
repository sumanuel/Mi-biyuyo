require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const pool = require("../config/database");
const { body } = require("express-validator");
const { sendMail, mailConfigured } = require("../utils/mailer");

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

/**
 * Crea y envía un código de 6 dígitos para verificar el correo.
 * Respeta un intervalo mínimo entre envíos. Devuelve { devCode } solo si el
 * correo no está configurado y el servidor no está en producción.
 */
async function issueVerificationCode(user) {
  const { rows: last } = await pool.query(
    `SELECT created_at FROM email_verification_codes
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [user.id],
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
    `UPDATE email_verification_codes SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
    [user.id],
  );
  await pool.query(
    `INSERT INTO email_verification_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, hashCode(code), new Date(Date.now() + CODE_MINUTES * 60000)],
  );
  try {
    await sendMail({
      to: user.email,
      subject: "Tu código de verificación — Mi Biyuyo",
      text: `Tu código de verificación es ${code}. Vence en ${CODE_MINUTES} minutos.`,
      html: `<p>Hola ${user.name || ""},</p>
             <p>Tu código para verificar tu correo en Mi Biyuyo es:</p>
             <p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p>
             <p>Vence en ${CODE_MINUTES} minutos. Si no creaste una cuenta, ignora este correo.</p>`,
    });
  } catch (mailErr) {
    console.error("Error enviando código:", mailErr.message);
  }
  const showDev = !mailConfigured() && process.env.NODE_ENV !== "production";
  return { devCode: showDev ? code : undefined };
}

async function sendResetEmail(to, resetUrl) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Restablecer contraseña — Mi Biyuyo",
    html: `<p>Haz clic en el siguiente enlace para restablecer tu contraseña (válido 60 min):</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>Si no solicitaste esto, ignora este correo.</p>`,
  });
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
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
      `INSERT INTO users (name, email, password_hash, avatar_color, email_verified) VALUES ($1, $2, $3, $4, false) RETURNING id, name, email`,
      [name.trim(), email.toLowerCase(), hash, avatarColor],
    );
    const user = userRows[0];

    // Create default exchange rates for new user
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
      `SELECT id, name, email, password_hash, avatar_color, theme_preference, email_verified FROM users WHERE email = $1`,
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
      `SELECT id, name, email, avatar_color, theme_preference, email_verified FROM users WHERE email = $1`,
      [email.toLowerCase()],
    );
    const invalid = httpError(400, "Código incorrecto o vencido");
    if (!users.length) throw invalid;
    const user = users[0];

    if (!user.email_verified) {
      const { rows } = await pool.query(
        `SELECT id, code_hash, attempts FROM email_verification_codes
         WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
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
      `SELECT id, name, email, avatar_color, theme_preference, created_at FROM users WHERE id = $1`,
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
       WHERE id = $3 RETURNING id, name, email, avatar_color, theme_preference`,
      [name || null, theme_preference || null, req.user.id],
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    // Always respond 200 to avoid user enumeration
    if (!rows.length)
      return res.json({ message: "Si el correo existe recibirás un enlace" });

    const userId = rows[0].id;
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(
      Date.now() +
        parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || "60") * 60000,
    );

    // Invalidate previous tokens
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );

    const resetUrl = `mibiyuyo://reset-password?token=${rawToken}`;
    try {
      await sendResetEmail(email, resetUrl);
    } catch (emailErr) {
      console.error("Error enviando email:", emailErr.message);
    }

    res.json({ message: "Si el correo existe recibirás un enlace" });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const { rows } = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );
    if (!rows.length)
      return res.status(400).json({ error: "Token inválido o expirado" });

    const { id: tokenId, user_id } = rows[0];
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [hash, user_id],
    );
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [tokenId],
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
  body("token").notEmpty(),
  body("password").isLength({ min: 6 }),
];
