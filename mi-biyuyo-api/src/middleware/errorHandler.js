module.exports = function errorHandler(err, req, res, next) {
  // JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: "Formato de solicitud inválido (JSON malformado)" });
  }

  console.error("[Error]", err.message);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Error interno del servidor";
  res.status(status).json({ error: message });
};
