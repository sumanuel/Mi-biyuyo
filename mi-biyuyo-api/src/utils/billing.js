const crypto = require("crypto");
const pool = require("../config/database");
const { sendMail, mailConfigured } = require("./mailer");

/** Moneda en que se paga cada método (los demás se pagan en USD). */
const METHOD_CCY = { pago_movil: "VES" };
const ccyOfMethod = (method) => METHOD_CCY[method] || "USD";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const dateEs = (d) =>
  new Date(d).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Suma días de Premium: nuevo vencimiento = max(ahora, vencimiento actual) + días.
 * Un pago nuevo se suma al que ya tenía, no lo reemplaza. Devuelve el nuevo `premium_until`.
 */
async function extendPremium(db, userId, days) {
  const { rows } = await db.query(
    `UPDATE users
     SET premium_until = GREATEST(NOW(), COALESCE(premium_until, NOW())) + make_interval(days => $2),
         updated_at = NOW()
     WHERE id = $1 RETURNING premium_until`,
    [userId, days],
  );
  return rows[0]?.premium_until || null;
}

/* ---------- códigos de canje ---------- */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sin 0, O, 1, I, L
const CODE_LEN = 12;

/** Código nuevo al azar: 12 caracteres sin letras que se confundan. */
function makeCode() {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++)
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  return out;
}

/** «abcd-ef23 ghjk» → «ABCDEF23GHJK» (se guarda y se compara sin guiones ni espacios). */
const normalizeCode = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** «ABCDEF23GHJK» → «ABCD-EF23-GHJK» para mostrarlo. */
const formatCode = (c) => (c.length === CODE_LEN ? c.match(/.{4}/g).join("-") : c);

/* ---------- correos ---------- */
const adminEmail = () => (process.env.ADMIN_NOTIFY_EMAIL || "").trim();

async function send(to, subject, text, html) {
  if (!to) return { sent: false };
  try {
    return await sendMail({ to, subject, text, html });
  } catch (err) {
    // Un fallo de correo nunca debe tumbar el pago ni la aprobación
    console.error(`[Correo] No se pudo enviar «${subject}»:`, err.code || err.message);
    return { sent: false };
  }
}

const wrap = (name, lines) =>
  `<p>Hola ${esc(name || "")},</p>${lines.map((l) => `<p>${l}</p>`).join("")}<p>Mi Biyuyo</p>`;

const mailPaymentReceived = (u, p) =>
  send(
    u.email,
    "Recibimos tu pago — Mi Biyuyo",
    `Recibimos tu solicitud de pago (${p.method}, ref. ${p.reference}). La revisaremos pronto y te avisaremos.`,
    wrap(u.name, [
      `Recibimos tu solicitud de pago (<b>${esc(p.method)}</b>, referencia <b>${esc(p.reference)}</b>).`,
      "La revisaremos pronto y te avisaremos por este medio.",
    ]),
  );

const mailPaymentApproved = (u, p, until) =>
  send(
    u.email,
    "Tu pago fue aprobado — Mi Biyuyo",
    `Tu pago fue aprobado. Tu plan Premium está activo hasta el ${dateEs(until)}.`,
    wrap(u.name, [
      "¡Tu pago fue aprobado!",
      `Tu plan Premium está activo hasta el <b>${dateEs(until)}</b>. Gracias por apoyar Mi Biyuyo.`,
    ]),
  );

const mailPaymentRejected = (u, p, reason) =>
  send(
    u.email,
    "No pudimos aprobar tu pago — Mi Biyuyo",
    `No pudimos aprobar tu pago (ref. ${p.reference}). Motivo: ${reason || "sin detalle"}. Puedes enviar otra solicitud desde Ajustes > Mi plan.`,
    wrap(u.name, [
      `No pudimos aprobar tu pago (referencia <b>${esc(p.reference)}</b>).`,
      `Motivo: ${esc(reason || "sin detalle")}.`,
      "Puedes enviar otra solicitud desde Ajustes &gt; Mi plan.",
    ]),
  );

/** Avisa al administrador de que hay un pago por revisar (si ADMIN_NOTIFY_EMAIL está configurado). */
const mailAdminNewPayment = (u, p) =>
  send(
    adminEmail(),
    "Nuevo pago por revisar — Mi Biyuyo",
    `${u.email} envió un pago por ${p.method} (ref. ${p.reference}). Revísalo en la página de administración.`,
    `<p><b>${esc(u.email)}</b> envió un pago por ${esc(p.method)} (referencia ${esc(p.reference)}). Revísalo en la página de administración.</p>`,
  );

/**
 * Avisa por correo a quien le vence pronto la prueba o el Premium (una sola vez por vencimiento).
 * Sin correo configurado no hace nada (y no marca el aviso como enviado). `sendFn` permite probarlo.
 * Devuelve la cantidad de avisos enviados.
 */
async function runExpiryNotices({ sendFn = sendMail, configured = mailConfigured(), days = 3 } = {}) {
  if (!configured) return 0;
  let sent = 0;
  const jobs = [
    {
      col: "premium_until",
      notice: "expiry_notice_for",
      subject: "Tu plan Premium vence pronto — Mi Biyuyo",
      line: (d) => `Tu plan Premium vence el <b>${dateEs(d)}</b>. Para no perder las funciones Premium, renuévalo desde Ajustes &gt; Mi plan.`,
    },
    {
      col: "trial_ends_at",
      notice: "trial_notice_for",
      subject: "Tu prueba Premium termina pronto — Mi Biyuyo",
      line: (d) => `Tu prueba Premium termina el <b>${dateEs(d)}</b>. Después pasas al plan Gratis y no se borra nada. Si quieres seguir con Premium, actívalo desde Ajustes &gt; Mi plan.`,
    },
  ];
  for (const j of jobs) {
    const { rows } = await pool.query(
      `SELECT id, name, email, ${j.col} AS until FROM users
       WHERE email_verified = TRUE
         AND ${j.col} > NOW() AND ${j.col} <= NOW() + make_interval(days => $1)
         AND ${j.notice} IS DISTINCT FROM ${j.col}
         -- el aviso de prueba no tiene sentido si ya tiene Premium vigente
         ${j.col === "trial_ends_at" ? "AND (premium_until IS NULL OR premium_until <= NOW())" : ""}`,
      [days],
    );
    for (const u of rows) {
      try {
        await sendFn({
          to: u.email,
          subject: j.subject,
          text: j.line(u.until).replace(/<[^>]+>/g, "").replace(/&gt;/g, ">"),
          html: wrap(u.name, [j.line(u.until)]),
        });
        await pool.query(`UPDATE users SET ${j.notice} = ${j.col} WHERE id = $1`, [u.id]);
        sent++;
      } catch (err) {
        console.error("[Correo] Aviso de vencimiento no enviado:", err.code || err.message);
      }
    }
  }
  return sent;
}

module.exports = {
  ccyOfMethod,
  extendPremium,
  makeCode,
  normalizeCode,
  formatCode,
  mailPaymentReceived,
  mailPaymentApproved,
  mailPaymentRejected,
  mailAdminNewPayment,
  runExpiryNotices,
};
