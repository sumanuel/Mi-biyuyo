const nodemailer = require("nodemailer");

/**
 * Configuración de correo. Acepta los nombres EMAIL_* (los de esta API) y, como alternativa,
 * SMTP_* (los que usa la API de T-SAFV), para que un .env copiado de allí también funcione.
 */
const pick = (...names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};

function mailEnv() {
  return {
    host: pick("EMAIL_HOST", "SMTP_HOST"),
    port: parseInt(pick("EMAIL_PORT", "SMTP_PORT") || "587"),
    secure: pick("EMAIL_SECURE", "SMTP_SECURE") === "true",
    user: pick("EMAIL_USER", "SMTP_USER"),
    pass: pick("EMAIL_PASS", "SMTP_PASS"),
    from: pick("EMAIL_FROM", "SMTP_FROM"),
  };
}

/** Variables que faltan para poder enviar (por su nombre EMAIL_*). */
function mailMissing() {
  const c = mailEnv();
  return [
    ["EMAIL_HOST", c.host],
    ["EMAIL_USER", c.user],
    ["EMAIL_PASS", c.pass],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
}

/** ¿Hay un servidor de correo configurado de verdad? */
function mailConfigured() {
  return mailMissing().length === 0;
}

// Tiempos límite: sin ellos, un servidor SMTP inalcanzable deja la petición colgada ~2 minutos
function makeTransport() {
  const c = mailEnv();
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

// Resultado de la última comprobación de la conexión SMTP (solo el código, nunca el mensaje)
let lastCheck = null;

/**
 * Comprueba la conexión y el acceso al servidor SMTP sin enviar ningún correo.
 * Devuelve { ok, code }: code es "NOT_CONFIGURED" o el código del error (EAUTH, ETIMEDOUT…).
 * Con maxAgeMs reutiliza el último resultado si es más reciente que ese tiempo.
 */
async function verifyMail({ maxAgeMs = 0 } = {}) {
  if (maxAgeMs && lastCheck && Date.now() - lastCheck.at.getTime() < maxAgeMs)
    return lastCheck;
  if (!mailConfigured()) {
    lastCheck = { ok: false, code: "NOT_CONFIGURED", at: new Date() };
    return lastCheck;
  }
  try {
    await makeTransport().verify();
    lastCheck = { ok: true, code: null, at: new Date() };
  } catch (err) {
    lastCheck = { ok: false, code: err.code || "ERROR", at: new Date() };
  }
  return lastCheck;
}

/** Estado para /health: nunca incluye usuario, contraseña ni mensajes de error. */
function mailStatus() {
  const missing = mailMissing();
  return {
    configured: missing.length === 0,
    ...(missing.length ? { missing } : {}),
    smtp: lastCheck ? (lastCheck.ok ? "ok" : lastCheck.code) : "sin_comprobar",
  };
}

/** Texto de una línea para el log de arranque. */
function describeMail() {
  const c = mailEnv();
  if (!mailConfigured())
    return `Correo: NO configurado (faltan ${mailMissing().join(", ")}). Los códigos de verificación no se enviarán.`;
  const via = process.env.EMAIL_HOST ? "EMAIL_*" : "SMTP_*";
  return `Correo: configurado (${c.host}:${c.port}, variables ${via}).`;
}

/** Oculta el correo para los logs: j***@hotmail.com */
const maskEmail = (e) => String(e || "").replace(/^(.).*(@.*)$/, "$1***$2");

/**
 * Envía un correo. Sin SMTP configurado escribe el mensaje en la consola del servidor
 * (útil en desarrollo) y devuelve { sent: false }.
 */
async function sendMail({ to, subject, html, text }) {
  if (!mailConfigured()) {
    console.log(
      `[Correo no configurado] Para: ${to} · ${subject}\n${text || ""}`,
    );
    return { sent: false };
  }
  const c = mailEnv();
  await makeTransport().sendMail({
    from: c.from || c.user,
    to,
    subject,
    html,
    text,
  });
  return { sent: true };
}

module.exports = {
  sendMail,
  mailConfigured,
  verifyMail,
  mailStatus,
  describeMail,
  maskEmail,
};
