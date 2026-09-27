function errorHandler(error, req, res, next) {
  console.error(
    "Request error:",
    error.message,
  );

  const statusCode =
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode < 600
      ? error.statusCode
      : 500;

  res.status(statusCode).json({
    success: false,
    message:
      error.expose
        ? error.message
        : "Internal server error",
  });
}

module.exports = errorHandler;
