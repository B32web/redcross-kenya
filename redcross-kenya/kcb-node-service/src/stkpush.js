const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const logger = require('./logger');
const { getAccessToken, invalidateToken } = require('./kcbAuth');
const db = require('./db');

const STK_URL = `${config.kcb.baseUrl}/mm/api/request/1.0.0/stkpush`;

class StkPushError extends Error {
  constructor(message, { statusCode, code, retryable = false, details } = {}) {
    super(message);
    this.name = 'StkPushError';
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

function normalizePhoneNumber(input) {
  if (!input) throw new StkPushError('Phone number is required', { code: 'INVALID_PHONE' });
  let phone = String(input).trim().replace(/[\s-]/g, '');

  if (phone.startsWith('+')) phone = phone.slice(1);
  if (phone.startsWith('0')) phone = `254${phone.slice(1)}`;
  if (phone.startsWith('7') || phone.startsWith('1')) phone = `254${phone}`;

  if (!/^254(7|1)\d{8}$/.test(phone)) {
    throw new StkPushError(`Invalid Kenyan phone number: ${input}`, { code: 'INVALID_PHONE' });
  }
  return phone;
}

function validateAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 1) {
    throw new StkPushError('Amount must be a number >= 1 KES', { code: 'INVALID_AMOUNT' });
  }
  return String(Math.round(n));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initiateStkPush({ phoneNumber, amount, description, idempotencyKey }) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const normalizedAmount = validateAmount(amount);
  const internalId = idempotencyKey || uuidv4();

  const existing = db.findById(internalId);
  if (existing) {
    logger.info('Idempotent STK push request — returning existing transaction', { internalId, status: existing.status });
    return {
      internalId: existing.id,
      checkoutRequestId: existing.checkout_request_id,
      merchantRequestId: existing.merchant_request_id,
      status: existing.status,
      deduped: true,
    };
  }

  // 🔴 USING YOUR ACCOUNT NUMBER (1302047523) AS INVOICE NUMBER
  const invoiceNumber = config.kcb.invoiceNumber || `INV-${Date.now()}-${internalId.slice(0, 8)}`;
  
  db.createTransaction({
    id: internalId,
    invoiceNumber,
    phoneNumber: normalizedPhone,
    amount: normalizedAmount,
    description,
  });

  const payload = {
    phoneNumber: normalizedPhone,
    amount: normalizedAmount,
    invoiceNumber,
    sharedShortCode: config.kcb.sharedShortCode,
    orgShortCode: config.kcb.orgShortCode, // 🔴 522533
    orgPassKey: config.kcb.orgPassKey,
    callbackUrl: config.kcb.callbackUrl,
    transactionDescription: (description || 'Payment').slice(0, 60),
  };

  let lastError;
  let attemptsMade = 0;
  for (let attempt = 1; attempt <= config.stk.maxRetries; attempt++) {
    attemptsMade = attempt;
    try {
      const token = await getAccessToken();
      const response = await axios.post(STK_URL, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      });

      const body = response.data || {};
      const result = body.response || {};
      const header = body.header || {};

      const succeeded = String(result.ResponseCode) === '0' || String(header.statusCode) === '0';
      if (!succeeded) {
        db.markError(internalId, header.statusDescription || result.ResponseDescription || 'STK push rejected');
        throw new StkPushError(
          header.statusDescription || result.ResponseDescription || 'STK push was rejected by KCB',
          { code: 'REJECTED', details: body, retryable: false }
        );
      }

      db.attachInitResponse(internalId, {
        merchantRequestId: result.MerchantRequestID,
        checkoutRequestId: result.CheckoutRequestID,
        rawResponse: body,
      });

      logger.info('STK push initiated', {
        internalId,
        checkoutRequestId: result.CheckoutRequestID,
        phone: normalizedPhone,
        amount: normalizedAmount,
        orgShortCode: config.kcb.orgShortCode,
        invoiceNumber: invoiceNumber,
      });

      return {
        internalId,
        checkoutRequestId: result.CheckoutRequestID,
        merchantRequestId: result.MerchantRequestID,
        customerMessage: result.CustomerMessage,
        status: 'PENDING',
        deduped: false,
      };
    } catch (err) {
      if (err instanceof StkPushError) throw err;

      lastError = err;
      const status = err.response?.status;

      if (status === 401) {
        invalidateToken();
      }

      const retryable = !status || status >= 500 || status === 401 || err.code === 'ECONNABORTED';
      logger.warn(`STK push attempt ${attempt}/${config.stk.maxRetries} failed`, {
        internalId,
        status,
        message: err.message,
        retryable,
      });

      if (!retryable || attempt === config.stk.maxRetries) break;

      const backoff = 500 * 2 ** (attempt - 1) + Math.random() * 250;
      await sleep(backoff);
    }
  }

  const message = lastError?.response?.data
    ? JSON.stringify(lastError.response.data)
    : lastError?.message || 'Unknown error contacting KCB Buni gateway';
  db.markError(internalId, message);
  throw new StkPushError(`STK push failed after ${attemptsMade} attempt(s): ${message}`, {
    statusCode: lastError?.response?.status,
    code: 'GATEWAY_ERROR',
    retryable: true,
  });
}

module.exports = { initiateStkPush, normalizePhoneNumber, validateAmount, StkPushError };