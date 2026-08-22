const axios = require('axios');
require('dotenv').config();

async function testCredentials() {
  const consumerKey = process.env.KCB_CONSUMER_KEY;
  const consumerSecret = process.env.KCB_CONSUMER_SECRET;
  const tokenUrl = process.env.KCB_TOKEN_URL || 'https://accounts.buni.kcbgroup.com/oauth2/token';

  if (!consumerKey || !consumerSecret) {
    console.error('Missing KCB_CONSUMER_KEY / KCB_CONSUMER_SECRET in your .env file.');
    process.exit(1);
  }

  console.log('Testing KCB credentials...');
  console.log(`  Consumer Key: ${consumerKey.slice(0, 8)}...`);
  console.log(`  Token URL:    ${tokenUrl}`);

  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const response = await axios.post(
      `${tokenUrl}?grant_type=client_credentials`,
      {},
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` } }
    );

    console.log('✅ Success — access token generated:');
    console.log(`  Token (truncated): ${response.data.access_token.slice(0, 24)}...`);
    console.log(`  Expires in: ${response.data.expires_in} seconds`);
    return true;
  } catch (error) {
    console.error('❌ Credential test failed:');
    console.error(' ', error.response?.data || error.message);
    return false;
  }
}

testCredentials();