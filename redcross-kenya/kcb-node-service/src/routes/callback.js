const express = require('express');
const config = require('../config');
const db = require('../db');
const logger = require('../logger');

const router = express.Router();

function extractCallbackItems(items = []) {
  const map = {};
  for (const item of items) {
    if (item && item.Name) map[item.Name] = item.Value;
  }
  return map;
}

router.post('/callback', express.json({ limit: '256kb' }), (req, res) => {
  try {
    if (config.callbackSharedToken) {
      const token = req.query.token;
      if (token !== config.callbackSharedToken) {
        logger.warn('Rejected callback with invalid/missing token', { ip: req.ip });
        return res.status(200).json({ received: true });
      }
    }

    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback || !stkCallback.CheckoutRequestID) {
      logger.warn('Malformed callback payload received', { body: req.body });
      return res.status(200).json({ received: true });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    const items = extractCallbackItems(CallbackMetadata?.Item);

    const changed = db.applyCallback(CheckoutRequestID, {
      resultCode: ResultCode,
      resultDesc: ResultDesc,
      mpesaReceipt: items.MpesaReceiptNumber,
      rawPayload: req.body,
    });

    if (changed === 0) {
      logger.error('Callback received for unknown CheckoutRequestID', { CheckoutRequestID, ResultCode, ResultDesc });
    } else {
      logger.info('Payment callback processed', {
        CheckoutRequestID,
        ResultCode,
        success: String(ResultCode) === '0',
        receipt: items.MpesaReceiptNumber,
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error('Error processing callback', { error: err.message, stack: err.stack });
    return res.status(200).json({ received: true });
  }
});

module.exports = router;