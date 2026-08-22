// =============================================================
// supabase/functions/stk-push/index.ts
// Modified for registration fee and monthly aid
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (/^2547\d{8}$/.test(digits)) return digits;
  if (/^07\d{8}$/.test(digits)) return '254' + digits.slice(1);
  if (/^7\d{8}$/.test(digits)) return '254' + digits;
  if (/^01\d{8}$/.test(digits)) return '254' + digits.slice(1);
  return null;
}

async function getKcbToken(): Promise<string> {
  const consumerKey = Deno.env.get('KCB_CONSUMER_KEY') ?? '';
  const consumerSecret = Deno.env.get('KCB_CONSUMER_SECRET') ?? '';
  const tokenUrl = Deno.env.get('KCB_TOKEN_URL') ?? 'https://accounts.buni.kcbgroup.com/oauth2/token';

  if (!consumerKey || !consumerSecret) {
    throw new Error('KCB credentials are not configured on the server.');
  }

  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  const res = await fetch(`${tokenUrl}?grant_type=client_credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`KCB token request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('KCB token response had no access_token.');
  return data.access_token as string;
}

async function initiateStkPush(token: string, phone: string, amount: number, description: string) {
  const baseUrl = Deno.env.get('KCB_BASE_URL') ?? 'https://uat.buni.kcbgroup.com';
  const invoiceNumber = Deno.env.get('KCB_INVOICE_NUMBER') ?? '';
  const orgShortCode = Deno.env.get('KCB_ORG_SHORT_CODE') ?? '522522';
  const callbackUrl = Deno.env.get('KCB_CALLBACK_URL') ?? '';

  if (!invoiceNumber) throw new Error('KCB_INVOICE_NUMBER is not configured on the server.');
  if (!callbackUrl) throw new Error('KCB_CALLBACK_URL is not configured on the server.');

  const payload = {
    phoneNumber: phone,
    amount: String(amount),
    invoiceNumber,
    sharedShortCode: true,
    orgShortCode,
    orgPassKey: '',
    callbackUrl,
    transactionDescription: description || 'Red Cross Kenya aid',
  };

  const res = await fetch(`${baseUrl}/mm/api/request/1.0.0/stkpush`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await res.text();
  let body: any;
  try { body = JSON.parse(bodyText); } catch { body = { raw: bodyText }; }

  if (!res.ok) {
    throw new Error(`KCB STK push failed (${res.status}): ${bodyText}`);
  }

  return body;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { amount, phone: rawPhone, name, applicationId, type } = await req.json();

    if (!amount || amount < 100) {
      return json({ error: 'Amount must be at least KES 100.' }, 400);
    }

    const phone = normalizePhone(rawPhone ?? '');
    if (!phone) {
      return json({ error: 'Phone number must be a valid Safaricom number.' }, 400);
    }

    // Create payment record
    const { data: payment, error: payErr } = await supabaseAdmin
      .from('payments')
      .insert({
        amount,
        phone,
        donor_name: name || 'Anonymous',
        status: 'pending',
        application_id: applicationId || null,
        payment_type: type || 'registration_fee'
      })
      .select()
      .single();

    if (payErr || !payment) {
      console.error('Failed to create payment row:', payErr);
      return json({ error: 'Could not start payment. Please try again.' }, 500);
    }

    // Call KCB
    let kcbResponse: any;
    try {
      const token = await getKcbToken();
      const description = type === 'registration_fee' 
        ? 'Red Cross Kenya registration fee' 
        : 'Red Cross Kenya monthly aid';
      kcbResponse = await initiateStkPush(token, phone, amount, description);
    } catch (kcbError) {
      console.error('KCB STK push error:', kcbError);
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed', result_desc: String(kcbError) })
        .eq('id', payment.id);
      return json({ error: 'Failed to reach M-PESA. Please try again.' }, 502);
    }

    const requestId = kcbResponse?.CheckoutRequestID || kcbResponse?.checkoutRequestID || null;
    await supabaseAdmin
      .from('payments')
      .update({
        checkout_request_id: requestId,
        raw_request_response: kcbResponse,
      })
      .eq('id', payment.id);

    return json({
      success: true,
      paymentId: payment.id,
      message: 'STK push sent. Check your phone and enter your M-PESA PIN.',
    });

  } catch (error) {
    console.error('Unhandled error:', error);
    return json({ error: 'Unexpected server error. Please try again.' }, 500);
  }
});