const { Prisma } = require('@prisma/client');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config/env');

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || [];

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      const field = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target;
      message = `A record with this ${field || 'value'} already exists.`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'The requested record was not found.';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'Invalid reference to a related record.';
    } else {
      statusCode = 400;
      message = 'Database request error.';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided to the database.';
  } else if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Maximum allowed size is ${config.upload.maxFileSizeMb}MB.`
        : err.message;
  }

  if (statusCode >= 500) {
    logger.error(err.stack || err.message);
  }

  const payload = {
    success: false,
    statusCode,
    message,
  };
  if (errors && errors.length) payload.errors = errors;
  if (config.env === 'development' && statusCode >= 500) payload.stack = err.stack;

  res.status(statusCode).json(payload);
}

module.exports = errorHandler;
