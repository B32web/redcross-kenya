const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

const basicAuth = Buffer.from(`${config.kcb.consumerKey}:${config.kcb.consumerSecret}`).toString('base64');

let cachedToken = null;
let cachedExpiryMs = 0;
let inflightRequest = null;

const TOKEN_URL = `${config.kcb.baseUrl}/token?grant_type=client_credentials`;
const SAFETY_MARGIN_MS = 60 * 1000;

async function fetchNewToken() {
  const response = await axios.post(TOKEN_URL, null, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 15000,
  });

  const { access_token: accessToken, expires_in: expiresIn } = response.data || {};
  if (!accessToken) {
    throw new Error(`KCB token endpoint returned no access_token: ${JSON.stringify(response.data)}`);
  }

  cachedToken = accessToken;
  cachedExpiryMs = Date.now() + Number(expiresIn || 3600) * 1000 - SAFETY_MARGIN_MS;
  logger.info('Obtained new KCB Buni access token', { expiresIn });
  return cachedToken;
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedExpiryMs) {
    return cachedToken;
  }
  if (inflightRequest) {
    return inflightRequest;
  }
  inflightRequest = fetchNewToken().finally(() => {
    inflightRequest = null;
  });
  return inflightRequest;
}

function invalidateToken() {
  cachedToken = null;
  cachedExpiryMs = 0;
}

module.exports = { getAccessToken, invalidateToken };