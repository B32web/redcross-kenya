const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');
const logger = require('./logger');

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.db.path);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE,
    phone_number TEXT NOT NULL,
    amount TEXT NOT NULL,
    description TEXT,
    merchant_request_id TEXT,
    checkout_request_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    result_code TEXT,
    result_desc TEXT,
    mpesa_receipt TEXT,
    raw_init_response TEXT,
    raw_callback_payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_checkout_request_id ON transactions (checkout_request_id);
  CREATE INDEX IF NOT EXISTS idx_status ON transactions (status);
`);

function createTransaction({ id, invoiceNumber, phoneNumber, amount, description }) {
  const stmt = db.prepare(`
    INSERT INTO transactions (id, invoice_number, phone_number, amount, description)
    VALUES (@id, @invoiceNumber, @phoneNumber, @amount, @description)
  `);
  stmt.run({ id, invoiceNumber, phoneNumber, amount: String(amount), description: description || null });
}

function attachInitResponse(id, { merchantRequestId, checkoutRequestId, rawResponse }) {
  db.prepare(`
    UPDATE transactions
    SET merchant_request_id = @merchantRequestId,
        checkout_request_id = @checkoutRequestId,
        raw_init_response = @rawResponse,
        updated_at = datetime('now')
    WHERE id = @id
  `).run({ id, merchantRequestId, checkoutRequestId, rawResponse: JSON.stringify(rawResponse) });
}

function markError(id, message) {
  db.prepare(`
    UPDATE transactions
    SET status = 'ERROR', result_desc = @message, updated_at = datetime('now')
    WHERE id = @id
  `).run({ id, message: String(message).slice(0, 500) });
}

function findByCheckoutRequestId(checkoutRequestId) {
  return db.prepare(`SELECT * FROM transactions WHERE checkout_request_id = ?`).get(checkoutRequestId);
}

function findById(id) {
  return db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
}

function applyCallback(checkoutRequestId, { resultCode, resultDesc, mpesaReceipt, rawPayload }) {
  const status = String(resultCode) === '0' ? 'SUCCESS' : 'FAILED';
  const info = db.prepare(`
    UPDATE transactions
    SET status = @status,
        result_code = @resultCode,
        result_desc = @resultDesc,
        mpesa_receipt = @mpesaReceipt,
        raw_callback_payload = @rawPayload,
        updated_at = datetime('now')
    WHERE checkout_request_id = @checkoutRequestId
  `).run({
    checkoutRequestId,
    status,
    resultCode: String(resultCode),
    resultDesc: resultDesc || null,
    mpesaReceipt: mpesaReceipt || null,
    rawPayload: JSON.stringify(rawPayload),
  });
  return info.changes;
}

function sweepStalePending(timeoutSeconds) {
  const info = db.prepare(`
    UPDATE transactions
    SET status = 'TIMEOUT', result_desc = 'No callback received within timeout window', updated_at = datetime('now')
    WHERE status = 'PENDING'
      AND created_at <= datetime('now', @cutoff)
  `).run({ cutoff: `-${timeoutSeconds} seconds` });
  if (info.changes > 0) {
    logger.info(`Swept ${info.changes} stale pending transaction(s) to TIMEOUT`);
  }
  return info.changes;
}

module.exports = {
  db,
  createTransaction,
  attachInitResponse,
  markError,
  findByCheckoutRequestId,
  findById,
  applyCallback,
  sweepStalePending,
};