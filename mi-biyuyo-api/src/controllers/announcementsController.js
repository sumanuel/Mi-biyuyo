const pool = require("../config/database");
const { enabled: subscriptionsEnabled, planOf } = require("../utils/subscription");

/**
 * Anuncios para todos los usuarios: aparecen en la campanita de la app mientras están activos y
 * dentro de su ventana de fechas. Se administran desde /admin (Anuncios).
 */

// Pantallas a las que un anuncio puede llevar (la app muestra un botón «Abrir …»)
const SCREENS = ["Stats", "Entities", "Categories", "Planned", "Export", "Plans", "HelpCenter"];
// A quién llega: todos, quienes no tienen Premium (Gratis y en prueba) o quienes lo tienen pagado
const AUDIENCES = ["all", "free", "premium"];
const MAX_TITLE = 80;
const MAX_BODY = 500;

const fail = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

function toDate(v, label) {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw fail(400, `${label} no es una fecha válida`);
  return d;
}

function clean(b, { partial = false } = {}) {
  const out = {};
  if (!partial || b.title !== undefined) {
    const title = String(b.title ?? "").trim();
    if (!title) throw fail(400, "Escribe el título");
    if (title.length > MAX_TITLE) throw fail(400, `El título admite hasta ${MAX_TITLE} caracteres`);
    out.title = title;
  }
  if (!partial || b.body !== undefined) {
    const body = String(b.body ?? "").trim();
    if (!body) throw fail(400, "Escribe el mensaje");
    if (body.length > MAX_BODY) throw fail(400, `El mensaje admite hasta ${MAX_BODY} caracteres`);
    out.body = body;
  }
  if (!partial || b.screen !== undefined) {
    const screen = b.screen ? String(b.screen) : null;
    if (screen && !SCREENS.includes(screen)) throw fail(400, "Pantalla no válida");
    out.screen = screen;
  }
  if (!partial || b.audience !== undefined) {
    const audience = b.audience ? String(b.audience) : "all";
    if (!AUDIENCES.includes(audience)) throw fail(400, "Público no válido");
    out.audience = audience;
  }
  if (!partial || b.starts_at !== undefined) out.starts_at = toDate(b.starts_at, "El inicio") || new Date();
  if (!partial || b.ends_at !== undefined) out.ends_at = toDate(b.ends_at, "El fin");
  if (!partial || b.active !== undefined) out.active = b.active === undefined ? true : !!b.active;
  return out;
}

const COLS = "id, title, body, screen, audience, starts_at, ends_at, active, created_at, created_by";

/* ---------- usuarios (app) ---------- */
exports.listPublic = async (req, res, next) => {
  try {
    // Público: con las suscripciones apagadas no hay planes, así que solo llegan los de «todos»
    let audiences = ["all"];
    if (await subscriptionsEnabled()) {
      const u = (
        await pool.query(`SELECT trial_ends_at, premium_until FROM users WHERE id = $1`, [req.user.id])
      ).rows[0];
      audiences = ["all", u && planOf(u) === "premium" ? "premium" : "free"];
    }
    const { rows } = await pool.query(
      `SELECT id, title, body, screen, starts_at
         FROM announcements
        WHERE active AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at > NOW())
          AND audience = ANY($1)
        ORDER BY starts_at DESC, id DESC
        LIMIT 30`,
      [audiences],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/* ---------- administración ---------- */
exports.list = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLS} FROM announcements ORDER BY starts_at DESC, id DESC LIMIT 200`,
    );
    res.json({ screens: SCREENS, audiences: AUDIENCES, items: rows });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const d = clean(req.body || {});
    if (d.ends_at && d.ends_at <= d.starts_at) throw fail(400, "El fin debe ser posterior al inicio");
    const { rows } = await pool.query(
      `INSERT INTO announcements (title, body, screen, audience, starts_at, ends_at, active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLS}`,
      [d.title, d.body, d.screen, d.audience, d.starts_at, d.ends_at, d.active, req.admin?.email || "clave de emergencia"],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const d = clean(req.body || {});
    if (d.ends_at && d.ends_at <= d.starts_at) throw fail(400, "El fin debe ser posterior al inicio");
    const { rows } = await pool.query(
      `UPDATE announcements SET title=$2, body=$3, screen=$4, audience=$5, starts_at=$6, ends_at=$7, active=$8
        WHERE id = $1 RETURNING ${COLS}`,
      [req.params.id, d.title, d.body, d.screen, d.audience, d.starts_at, d.ends_at, d.active],
    );
    if (!rows.length) throw fail(404, "Anuncio no encontrado");
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM announcements WHERE id = $1`, [req.params.id]);
    if (!rowCount) throw fail(404, "Anuncio no encontrado");
    res.json({ message: "Eliminado" });
  } catch (err) {
    next(err);
  }
};
