require("dotenv").config();
const pool = require("../src/config/database");

const PARENTS = [
  {
    name: "Ingresos",
    type: "income",
    macro_type: null,
    icon: "trending-up",
    color: "#22C55E",
    sort_order: 1,
  },
  {
    name: "Gastos Esenciales",
    type: "expense",
    macro_type: "essential",
    icon: "shield-checkmark",
    color: "#4361EE",
    sort_order: 2,
  },
  {
    name: "Gastos Variables",
    type: "expense",
    macro_type: "variable",
    icon: "cart",
    color: "#F59E0B",
    sort_order: 3,
  },
  {
    name: "Préstamos Dados",
    type: "loan_given",
    macro_type: null,
    icon: "arrow-forward-circle",
    color: "#6C7FFF",
    sort_order: 4,
  },
  {
    name: "Deudas",
    type: "debt",
    macro_type: null,
    icon: "arrow-back-circle",
    color: "#EF4444",
    sort_order: 5,
  },
];

const CHILDREN = {
  Ingresos: [
    { name: "Sueldo", icon: "briefcase", color: "#22C55E" },
    { name: "Bono", icon: "gift", color: "#22C55E" },
    { name: "Freelance", icon: "laptop", color: "#22C55E" },
    { name: "Inversión", icon: "stats-chart", color: "#22C55E" },
    { name: "Otro ingreso", icon: "add-circle", color: "#22C55E" },
  ],
  "Gastos Esenciales": [
    { name: "Alimentación", icon: "fast-food", color: "#4361EE" },
    { name: "Vivienda", icon: "home", color: "#4361EE" },
    { name: "Servicios básicos", icon: "flash", color: "#4361EE" },
    { name: "Transporte", icon: "car", color: "#4361EE" },
    { name: "Salud", icon: "medkit", color: "#4361EE" },
    { name: "Educación", icon: "school", color: "#4361EE" },
  ],
  "Gastos Variables": [
    { name: "Entretenimiento", icon: "game-controller", color: "#F59E0B" },
    { name: "Ropa", icon: "shirt", color: "#F59E0B" },
    { name: "Restaurante", icon: "restaurant", color: "#F59E0B" },
    { name: "Tecnología", icon: "phone-portrait", color: "#F59E0B" },
    { name: "Viajes", icon: "airplane", color: "#F59E0B" },
    { name: "Otro gasto", icon: "add-circle", color: "#F59E0B" },
  ],
  "Préstamos Dados": [
    { name: "Familiar", icon: "people", color: "#6C7FFF" },
    { name: "Amigo", icon: "person", color: "#6C7FFF" },
    { name: "Compañero", icon: "person-add", color: "#6C7FFF" },
    { name: "Otro préstamo", icon: "add-circle", color: "#6C7FFF" },
  ],
  Deudas: [
    { name: "Crédito", icon: "card", color: "#EF4444" },
    { name: "Hipoteca", icon: "business", color: "#EF4444" },
    { name: "Préstamo personal", icon: "person", color: "#EF4444" },
    { name: "Tarjeta de crédito", icon: "card", color: "#EF4444" },
    { name: "Otra deuda", icon: "add-circle", color: "#EF4444" },
  ],
};

async function seed() {
  const client = await pool.connect();
  try {
    // Skip if defaults already loaded
    const { rows } = await client.query(
      `SELECT COUNT(*) FROM categories WHERE is_default = TRUE AND user_id IS NULL`,
    );
    if (parseInt(rows[0].count) > 0) {
      console.log("ℹ️  Categorías por defecto ya existen, saltando seed");
      return;
    }

    await client.query("BEGIN");

    for (const parent of PARENTS) {
      const { rows: pRows } = await client.query(
        `INSERT INTO categories (user_id, name, type, macro_type, icon, color, is_default, sort_order)
         VALUES (NULL, $1, $2, $3, $4, $5, TRUE, $6) RETURNING id`,
        [
          parent.name,
          parent.type,
          parent.macro_type,
          parent.icon,
          parent.color,
          parent.sort_order,
        ],
      );
      const parentId = pRows[0].id;

      const children = CHILDREN[parent.name] || [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        await client.query(
          `INSERT INTO categories (user_id, name, type, macro_type, icon, color, parent_id, is_default, sort_order)
           VALUES (NULL, $1, $2, $3, $4, $5, $6, TRUE, $7)`,
          [
            child.name,
            parent.type,
            parent.macro_type,
            child.icon,
            child.color,
            parentId,
            i + 1,
          ],
        );
      }
    }

    await client.query("COMMIT");
    console.log("✅ Seed completado: categorías por defecto insertadas");
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
