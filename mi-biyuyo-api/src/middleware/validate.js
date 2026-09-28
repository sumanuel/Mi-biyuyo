const { validationResult } = require("express-validator");

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Extrae el primer mensaje de error para mostrar un mensaje amigable
    const firstError = errors.array()[0];
    const message = firstError.msg || "Datos inválidos";
    return res.status(422).json({ error: message });
  }
  next();
};
