require('dotenv').config();

function required(name) {
  const val = process.env[name];
  if (!val || !val.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val.trim();
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),

  kcb: {
    consumerKey: required('KCB_CONSUMER_KEY'),
    consumerSecret: required('KCB_CONSUMER_SECRET'),
    baseUrl: (process.env.KCB_BASE_URL || 'https://uat.buni.kcbgroup.com').replace(/\/+$/, ''),
    orgShortCode: required('KCB_ORG_SHORT_CODE'),
    invoiceNumber: process.env.KCB_INVOICE_NUMBER || '',
    sharedShortCode: String(process.env.KCB_SHARED_SHORT_CODE || 'true').toLowerCase() === 'true',
    orgPassKey: process.env.KCB_ORG_PASSKEY || '',
    callbackUrl: required('KCB_CALLBACK_URL'),
  },

  callbackSharedToken: process.env.CALLBACK_SHARED_TOKEN || '',

  db: {
    path: process.env.SQLITE_PATH || './data/transactions.db',
  },

  stk: {
    maxRetries: Number(process.env.STK_MAX_RETRIES || 3),
    pendingTimeoutSeconds: Number(process.env.STK_PENDING_TIMEOUT_SECONDS || 90),
  },
};

if (config.env === 'production' && config.kcb.callbackUrl.startsWith('http://')) {
  throw new Error('KCB_CALLBACK_URL must be HTTPS in production — KCB will reject/fail plain HTTP callbacks.');
}

module.exports = config;