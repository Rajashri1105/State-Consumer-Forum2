require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const config = require('./config/env');
const logger = require('./config/logger');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// --------------------------------------------------------------------------
// Security & core middleware
// --------------------------------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (config.env === 'development') {
        const isLocalNetwork = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
        if (isLocalNetwork) return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(morgan(config.env === 'development' ? 'dev' : 'combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use('/api', apiLimiter);

// --------------------------------------------------------------------------
// Static file serving for uploaded evidence / judgments / profile images
// --------------------------------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, config.upload.dir)));

// --------------------------------------------------------------------------
// API routes
// --------------------------------------------------------------------------
app.use('/api/v1', routes);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'State Consumer Forum Portal API', version: '1.0.0' });
});

// --------------------------------------------------------------------------
// 404 + centralized error handling (must be last)
// --------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
