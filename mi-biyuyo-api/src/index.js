require("./config/loadEnv");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const errorHandler = require("./middleware/errorHandler");
const { verifyMail, mailStatus, describeMail } = require("./utils/mailer");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Root endpoint
app.get("/", (req, res) =>
  res.json({ message: "Mi Biyuyo API v1", health: "ok" }),
);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/exchange-rates", require("./routes/exchangeRates"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/entities", require("./routes/entities"));
app.use("/api/transfers", require("./routes/transfers"));
app.use("/api/ledger", require("./routes/ledger"));
app.use("/api/planned", require("./routes/planned"));

// /health?mail=check vuelve a comprobar el acceso SMTP (como mucho una vez por minuto)
app.get("/health", async (req, res) => {
  if (req.query.mail === "check") await verifyMail({ maxAgeMs: 60000 });
  res.json({
    status: "ok",
    app: "mi-biyuyo-api",
    env: process.env.NODE_ENV || "development",
    mail: mailStatus(),
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mi Biyuyo API corriendo en http://localhost:${PORT}`);
  // Diagnóstico del correo al arrancar (no bloquea el servidor ni envía nada)
  console.log(describeMail());
  verifyMail().then((r) =>
    console.log(
      r.ok
        ? "Correo: conexión SMTP verificada."
        : `Correo: no se pudo verificar la conexión SMTP (${r.code}).`,
    ),
  );
});
