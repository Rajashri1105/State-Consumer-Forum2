const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs after an array of express-validator chains. Collects any
 * validation failures into a single, consistent ApiError response.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = errors.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  throw ApiError.badRequest('Validation failed', formatted);
}

module.exports = validate;
