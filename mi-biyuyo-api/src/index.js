require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const errorHandler = require("./middleware/errorHandler");

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

app.get("/health", (req, res) =>
  res.json({ status: "ok", app: "mi-biyuyo-api" }),
);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Mi Biyuyo API corriendo en http://localhost:${PORT}`),
);
