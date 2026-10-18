// Cantidad de un ítem (por ejemplo 2, 1.5 o 0.250): mayor que 0 y hasta 3 decimales.
// Sin cantidad válida devuelve null (los ítems sin cantidad cuentan como 1 al sumar).
const MAX_QUANTITY = 1000000;

function cleanQuantity(v) {
  const n = parseFloat(v);
  if (!(n > 0) || n > MAX_QUANTITY) return null;
  return Math.round(n * 1000) / 1000;
}

module.exports = { cleanQuantity };
