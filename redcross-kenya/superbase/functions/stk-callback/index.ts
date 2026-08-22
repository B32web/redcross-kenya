// =============================================================
// supabase/functions/stk-callback/index.ts
// Edge Function: KCB calls THIS URL to report the result of an STK push.
// =============================================================
//
// Deploy:  supabase functions deploy stk-callback --no-verify-jwt
//
// This function is IDENTICAL to the ShieldPath version and works
// for registration fee and monthly aid payments.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function ok() {
  return new Response('OK', { status: 200 });
}

function parseCallback(payload: any) {
  const stk = payload?.Body?.stkCallback ?? payload?.stkCallback ?? payload;

  const resultCode = stk?.ResultCode ?? stk?.resultCode ?? stk?.status;
  const resultDesc = stk?.ResultDesc ?? stk?.resultDesc ?? stk?.description ?? '';

  const requestId =
    stk?.CheckoutRequestID ??
    stk?.checkoutRequestID ??
    stk?.MerchantRequestID ??
    stk?.merchantRequestID ??
    stk?.requestId ??
    stk?.transactionReference ??
    stk?.id ??
    null;

  const items = stk?.CallbackMetadata?.Item ?? stk?.callbackMetadata?.item ?? [];
  const findItem = (name: string) =>
    Array.isArray(items) ? items.find((i: any) => i.Name === name || i.name === name)?.Value : undefined;

  const amount = findItem('Amount') ?? stk?.amount;
  const mpesaReceipt = findItem('MpesaReceiptNumber') ?? stk?.mpesaReceiptNumber ?? stk?.receiptNumber;
  const phone = findItem('PhoneNumber') ?? stk?.phoneNumber;

  const isSuccess = resultCode === 0 || resultCode === '0' ||
    String(resultCode).toLowerCase() === 'success' ||
    String(resultCode).toLowerCase() === 'completed';

  return { requestId, isSuccess, resultCode, resultDesc, amount, mpesaReceipt, phone };
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let payload: any;
  try {
    payload = await req.json();
  } catch (e) {
    console.error('stk-callback: could not parse JSON body', e);
    return ok();
  }

  console.log('stk-callback received:', JSON.stringify(payload));

  try {
    const parsed = parseCallback(payload);

    // Find payment by checkout_request_id
    let payment = null;
    if (parsed.requestId) {
      const { data } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('checkout_request_id', parsed.requestId)
        .eq('status', 'pending')
        .maybeSingle();
      payment = data;
    }

    if (!payment && parsed.phone) {
      const { data } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('phone', String(parsed.phone))
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      payment = data;
    }

    if (!payment) {
      console.error('stk-callback: no matching pending payment found for', parsed);
      await supabaseAdmin.from('unmatched_callbacks').insert({ raw: payload });
      return ok();
    }

    const newStatus = parsed.isSuccess ? 'success' : 'failed';

    await supabaseAdmin
      .from('payments')
      .update({
        status: newStatus,
        result_code: String(parsed.resultCode ?? ''),
        result_desc: parsed.resultDesc,
        mpesa_receipt: parsed.mpesaReceipt ?? null,
        raw_callback: payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    // If payment is successful and it's a registration_fee, update application status
    if (parsed.isSuccess && payment.payment_type === 'registration_fee' && payment.application_id) {
      await supabaseAdmin
        .from('aid_applications')
        .update({
          status: 'pending_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.application_id);
    }

    return ok();
  } catch (error) {
    console.error('stk-callback: unhandled error', error);
    return ok();
  }
});