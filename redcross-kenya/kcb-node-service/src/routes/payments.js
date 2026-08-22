const express = require('express');
const { initiateStkPush, StkPushError } = require('../stkPush');
const db = require('../db');
const logger = require('../logger');

const router = express.Router();

router.post('/stk-push', async (req, res) => {
  const { phoneNumber, amount, description, orderId } = req.body || {};

  if (!phoneNumber || amount === undefined || amount === null) {
    return res.status(400).json({ ok: false, error: 'phoneNumber and amount are required' });
  }

  try {
    const result = await initiateStkPush({
      phoneNumber,
      amount,
      description,
      idempotencyKey: orderId,
    });

    return res.status(202).json({
      ok: true,
      message: result.deduped
        ? 'A payment request for this order is already in progress or completed'
        : 'STK push sent — ask the customer to check their phone and enter their M-Pesa PIN',
      transactionId: result.internalId,
      checkoutRequestId: result.checkoutRequestId,
      status: result.status,
    });
  } catch (err) {
    if (err instanceof StkPushError) {
      const httpStatus = err.code === 'INVALID_PHONE' || err.code === 'INVALID_AMOUNT' ? 400 : 502;
      logger.warn('STK push request failed', { code: err.code, message: err.message });
      return res.status(httpStatus).json({ ok: false, error: err.message, code: err.code });
    }
    logger.error('Unexpected error initiating STK push', { error: err.message, stack: err.stack });
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

router.get('/status/:transactionId', (req, res) => {
  const tx = db.findById(req.params.transactionId);
  if (!tx) {
    return res.status(404).json({ ok: false, error: 'Transaction not found' });
  }
  return res.json({
    ok: true,
    transactionId: tx.id,
    status: tx.status,
    amount: tx.amount,
    mpesaReceipt: tx.mpesa_receipt || null,
    resultDesc: tx.result_desc || null,
    createdAt: tx.created_at,
    updatedAt: tx.updated_at,
  });
});

module.exports = router;