const express = require('express');
const cors = require('cors'); // ← ADDED
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./logger');
const db = require('./db');
const paymentsRouter = require('./routes/payments');
const callbackRouter = require('./routes/callback');

const app = express();
app.disable('x-powered-by');
app.use(helmet());

// =============================================================
// CORS – Allow your frontend origins
// =============================================================
const allowedOrigins = [
  'https://kenya-redcross-officiall-website-xu2icfxvr-b32webs-projects.vercel.app',
  'https://redcross-kenya-ebbh8zugo-b32webs-projects.vercel.app',
  'https://redcross-kenya-36g9-1xtdbtpu4-b32webs-projects.vercel.app',
  // If you're using a custom domain, add it here
  // For testing, you can also allow all origins: app.use(cors());
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn('Blocked CORS request from origin', { origin });
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: false,
}));

app.use(express.json({ limit: '256kb' }));

// Rate limiting for STK push
const stkPushLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many payment requests — please wait a moment and try again' },
});

// Mount routes
app.use('/api/payments/stk-push', stkPushLimiter);
app.use('/api/payments', paymentsRouter);
app.use('/api/payments', callbackRouter);

// Health check
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// Sweep stale transactions
const sweeper = setInterval(() => {
  try {
    db.sweepStalePending(config.stk.pendingTimeoutSeconds);
  } catch (err) {
    logger.error('Sweeper failed', { error: err.message });
  }
}, 30 * 1000);

const server = app.listen(config.port, () => {
  logger.info(`KCB STK push service listening on port ${config.port}`, { env: config.env });
});

function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  clearInterval(sweeper);
  server.close(() => {
    db.db.close();
    logger.info('Shutdown complete');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

module.exports = app;
