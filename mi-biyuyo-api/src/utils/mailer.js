const nodemailer = require("nodemailer");

/** ¿Hay un servidor de correo configurado de verdad? */
function mailConfigured() {
  return !!(
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS
  );
}

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
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
  return { sent: true };
}

module.exports = { sendMail, mailConfigured };
