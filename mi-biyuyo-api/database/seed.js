require("dotenv").config();
const pool = require("../src/config/database");

// Categorías del prototipo. type: income | expense | loan_given (por cobrar) | debt (por pagar)
// icon: clave del catálogo de iconos de la app (src/components/icons.js)
const CATS = [
  ["i-sueldo", "income", "Sueldo", "sueldo"],
  ["i-bono", "income", "Bono", "bono"],
  ["i-free", "income", "Freelance", "laptop"],
  ["i-negocio", "income", "Negocio", "store"],
  ["i-alquiler", "income", "Alquiler", "home"],
  ["i-inversion", "income", "Inversiones", "trend"],
  ["i-remesa", "income", "Remesa", "globe"],
  ["i-reembolso", "income", "Reembolso", "undo"],
  ["i-regalo", "income", "Regalo recibido", "bono"],
  ["i-venta", "income", "Venta de artículos", "bag"],
  ["i-pension", "income", "Pensión", "user"],
  ["i-otro", "income", "Otro ingreso", "more"],
  ["g-food", "expense", "Alimentación", "food"],
  ["g-car", "expense", "Vehículo", "car"],
  ["g-home", "expense", "Vivienda", "home"],
  ["g-serv", "expense", "Servicios", "zap"],
  ["g-school", "expense", "Colegio", "cap"],
  ["g-health", "expense", "Salud", "cross"],
  ["g-transp", "expense", "Transporte", "bus"],
  ["g-ropa", "expense", "Ropa", "shirt"],
  ["g-ocio", "expense", "Ocio", "game"],
  ["g-pets", "expense", "Mascotas", "paw"],
  ["g-tech", "expense", "Tecnología", "phone"],
  ["g-care", "expense", "Cuidado personal", "scissors"],
  ["g-viaje", "expense", "Viajes", "plane"],
  ["g-subs", "expense", "Suscripciones", "tv"],
  ["g-seguro", "expense", "Seguros", "shield"],
  ["g-tax", "expense", "Impuestos", "receipt"],
  ["g-regalo", "expense", "Regalos", "bono"],
  ["g-otro", "expense", "Otro gasto", "more"],
  ["c-fam", "loan_given", "Familiar", "people"],
  ["c-amigo", "loan_given", "Amigo", "user"],
  ["c-trab", "loan_given", "Compañero de trabajo", "briefcase"],
  ["c-cliente", "loan_given", "Cliente", "store"],
  ["c-adelanto", "loan_given", "Adelanto de sueldo", "sueldo"],
  ["c-credito", "loan_given", "Venta a crédito", "bag"],
  ["c-alquiler", "loan_given", "Alquiler por cobrar", "home"],
  ["c-otro", "loan_given", "Otro", "more"],
  ["p-banco", "debt", "Crédito bancario", "bank"],
  ["p-tarjeta", "debt", "Tarjeta de crédito", "card"],
  ["p-fam", "debt", "Préstamo familiar", "people"],
  ["p-amigo", "debt", "Préstamo de amigo", "user"],
  ["p-cuotas", "debt", "Compra a cuotas", "bag"],
  ["p-alquiler", "debt", "Alquiler", "home"],
  ["p-serv", "debt", "Servicios pendientes", "zap"],
  ["p-school", "debt", "Colegio", "cap"],
  ["p-otro", "debt", "Otra deuda", "more"],
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Las categorías anteriores (sin code) se desactivan; los movimientos que
    // ya las usan conservan su referencia.
    await client.query(
      `UPDATE categories SET active = FALSE
       WHERE is_default = TRUE AND user_id IS NULL AND code IS NULL`,
    );

    let added = 0;
    for (let i = 0; i < CATS.length; i++) {
      const [code, type, name, icon] = CATS[i];
      const { rowCount } = await client.query(
        `INSERT INTO categories (user_id, code, name, type, icon, color, is_default, sort_order)
         SELECT NULL, $1::varchar, $2::varchar, $3::varchar, $4::varchar, '#1F7A59', TRUE, $5
         WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = $1 AND user_id IS NULL)`,
        [code, name, type, icon, i + 1],
      );
      added += rowCount;
    }

    await client.query("COMMIT");
    console.log(`✅ Seed completado: ${added} categorías nuevas`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error en seed:", err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
