/**
 * Límite de intentos fallidos en memoria (clave → intentos dentro de una ventana de tiempo).
 * Sirve para frenar la adivinanza de la clave de administración y de códigos de canje. Se
 * reinicia si el servidor se reinicia, lo cual es aceptable para este uso.
 */
function makeLimiter(max, windowMs) {
  const hits = new Map(); // clave → { n, resetAt }

  const live = (key) => {
    const h = hits.get(key);
    if (h && h.resetAt > Date.now()) return h;
    hits.delete(key);
    return null;
  };

  return {
    /** Segundos que faltan para poder reintentar (0 = no está bloqueado). */
    blockedFor(key) {
      const h = live(key);
      return h && h.n >= max ? Math.ceil((h.resetAt - Date.now()) / 1000) : 0;
    },
    /** Registra un intento fallido. */
    fail(key) {
      const h = live(key) || { n: 0, resetAt: Date.now() + windowMs };
      h.n += 1;
      hits.set(key, h);
    },
    /** Olvida los fallos de la clave (tras un acierto). */
    clear(key) {
      hits.delete(key);
    },
  };
}

module.exports = { makeLimiter };
