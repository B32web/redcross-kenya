// =============================================================
// APPLY.JS – Aid application with tier assessment
// =============================================================

const TIER_CONFIG = {
  disability_severe: {
    tier: 5,
    label: 'Severe Disability',
    amount: 30000,
    fee: 1000
  },
  disability_moderate: {
    tier: 5,
    label: 'Moderate Disability',
    amount: 30000,
    fee: 1000
  },
  parent_death_both: {
    tier: 4,
    label: 'Loss of Both Parents',
    amount: 25000,
    fee: 600
  },
  parent_death_one: {
    tier: 4,
    label: 'Loss of One Parent',
    amount: 25000,
    fee: 600
  },
  disease_chronic: {
    tier: 3,
    label: 'Chronic Disease',
    amount: 20000,
    fee: 450
  },
  disease_acute: {
    tier: 3,
    label: 'Acute Disease',
    amount: 20000,
    fee: 450
  },
  calamity: {
    tier: 2,
    label: 'Natural Calamity',
    amount: 15000,
    fee: 350
  },
  general: {
    tier: 1,
    label: 'General Hardship',
    amount: 10000,
    fee: 250
  }
};

// =============================================================
// TIER ASSESSMENT
// =============================================================

function assessTier() {
  const disability = document.getElementById('q-disability')?.value;
  const disease = document.getElementById('q-disease')?.value;
  const parentDeath = document.getElementById('q-parent-death')?.value;
  const calamity = document.getElementById('q-calamity')?.value;
  const general = document.getElementById('q-general')?.value;

  if (disability === 'yes-severe') return TIER_CONFIG.disability_severe;
  if (disability === 'yes-moderate') return TIER_CONFIG.disability_moderate;
  if (parentDeath === 'yes-both') return TIER_CONFIG.parent_death_both;
  if (parentDeath === 'yes-one') return TIER_CONFIG.parent_death_one;
  if (disease === 'yes-chronic') return TIER_CONFIG.disease_chronic;
  if (disease === 'yes-acute') return TIER_CONFIG.disease_acute;
  if (calamity && calamity !== 'no') return TIER_CONFIG.calamity;
  if (general === 'yes') return TIER_CONFIG.general;
  return null;
}

// =============================================================
// DISPLAY ASSESSMENT
// =============================================================

function displayAssessment() {
  const result = assessTier();
  const resultDiv = document.getElementById('assessment-result');
  const errorEl = document.getElementById('step2-error');

  if (!result || !resultDiv) {
    if (errorEl) {
      errorEl.textContent = 'Please answer the questions to assess your tier.';
      errorEl.classList.add('show');
    }
    return;
  }

  if (errorEl) errorEl.classList.remove('show');

  resultDiv.style.display = 'block';
  document.getElementById('assessed-tier').textContent = result.label;
  document.getElementById('assessed-amount').textContent = 'KES ' + result.amount.toLocaleString();
  document.getElementById('assessed-fee').textContent = 'KES ' + result.fee.toLocaleString();

  resultDiv.dataset.tier = result.tier;
  resultDiv.dataset.amount = result.amount;
  resultDiv.dataset.fee = result.fee;
  resultDiv.dataset.label = result.label;
}

// =============================================================
// STEPPER NAVIGATION
// =============================================================

function goToStep(stepNum) {
  const step1 = document.getElementById('reg-step-1');
  const step2 = document.getElementById('reg-step-2');
  const step3 = document.getElementById('reg-step-3');

  if (step1) step1.style.display = stepNum === 1 ? 'block' : 'none';
  if (step2) step2.style.display = stepNum === 2 ? 'block' : 'none';
  if (step3) step3.style.display = stepNum === 3 ? 'block' : 'none';

  const nav1 = document.getElementById('step-nav-1');
  const nav2 = document.getElementById('step-nav-2');
  const nav3 = document.getElementById('step-nav-3');

  if (nav1) nav1.className = 'step-item ' + (stepNum >= 1 ? 'active' : '');
  if (nav2) nav2.className = 'step-item ' + (stepNum >= 2 ? 'active' : '');
  if (nav3) nav3.className = 'step-item ' + (stepNum >= 3 ? 'active' : '');

  // Validate Step 1 → Step 2
  if (stepNum === 2) {
    const name = document.getElementById('reg-fullName')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const phone = document.getElementById('reg-phone')?.value.trim();
    const idNum = document.getElementById('reg-idNum')?.value.trim();
    const location = document.getElementById('reg-location')?.value.trim();

    const errorEl = document.getElementById('step1-error');
    if (!name || !email || !phone || !idNum || !location) {
      if (errorEl) {
        errorEl.textContent = 'Please complete all fields in Step 1.';
        errorEl.classList.add('show');
      }
      goToStep(1);
      return;
    }
    if (errorEl) errorEl.classList.remove('show');
  }

  // Validate Step 2 → Step 3
  if (stepNum === 3) {
    const resultDiv = document.getElementById('assessment-result');
    if (!resultDiv || !resultDiv.dataset.tier) {
      const errorEl = document.getElementById('step2-error');
      if (errorEl) {
        errorEl.textContent = 'Please complete the assessment first.';
        errorEl.classList.add('show');
      }
      goToStep(2);
      return;
    }

    // Fill summary
    document.getElementById('sum-name').textContent = document.getElementById('reg-fullName').value;
    document.getElementById('sum-phone').textContent = document.getElementById('reg-phone').value;
    document.getElementById('sum-county').textContent = document.getElementById('reg-location').value;
    document.getElementById('sum-tier').textContent = resultDiv.dataset.label;
    document.getElementById('sum-grant').textContent = 'KES ' + parseInt(resultDiv.dataset.amount).toLocaleString();
    document.getElementById('sum-fee').textContent = 'KES ' + parseInt(resultDiv.dataset.fee).toLocaleString();

    // Set payment details
    const fee = parseInt(resultDiv.dataset.fee);
    document.getElementById('payment-amount').textContent = fee.toLocaleString();
    document.getElementById('amount-ref').textContent = 'KES ' + fee.toLocaleString();

    const errorEl = document.getElementById('step2-error');
    if (errorEl) errorEl.classList.remove('show');
  }
}

// =============================================================
// SUBMIT APPLICATION – MANUAL PAYMENT
// =============================================================

async function submitApplicationManual() {
  const transactionCode = document.getElementById('mpesa-transaction-id')?.value.trim();
  const errorEl = document.getElementById('step3-error');

  if (!transactionCode) {
    if (errorEl) {
      errorEl.textContent = 'Please enter your M-PESA transaction code.';
      errorEl.classList.add('show');
    }
    return;
  }

  const resultDiv = document.getElementById('assessment-result');
  const tier = parseInt(resultDiv?.dataset.tier);
  const amount = parseInt(resultDiv?.dataset.amount);
  const fee = parseInt(resultDiv?.dataset.fee);
  const label = resultDiv?.dataset.label;

  const appData = {
    reference_code: 'MANUAL-' + Date.now(),
    full_name: document.getElementById('reg-fullName')?.value || '',
    email: document.getElementById('reg-email')?.value || '',
    phone: document.getElementById('reg-phone')?.value || '',
    id_number: document.getElementById('reg-idNum')?.value || '',
    county: document.getElementById('reg-location')?.value || '',
    description: document.getElementById('applicant-description')?.value || '',
    tier: tier,
    tier_label: label,
    aid_amount: amount,
    registration_fee: fee,
    mpesa_transaction_code: transactionCode,
    payment_method: 'manual_paybill',
    payment_status: 'pending_verification',
    status: 'pending_review',
    submitted_at: new Date().toISOString()
  };

  try {
    if (!window.supabaseClient) {
      throw new Error('Supabase is not initialized.');
    }

    const { data, error: supabaseError } = await window.supabaseClient
      .from('aid_applications')
      .insert(appData)
      .select();

    if (supabaseError) throw supabaseError;

    localStorage.setItem('last_application', JSON.stringify({
      ...appData,
      submittedAt: new Date().toLocaleDateString('en-KE')
    }));

    window.location.href = 'confirmation.html';

  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Submission failed: ' + (err.message || 'Unknown error');
      errorEl.classList.add('show');
    }
  }
}

// =============================================================
// INITIALIZE EVENT LISTENERS
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
  const assessBtn = document.getElementById('assess-btn');
  if (assessBtn) assessBtn.addEventListener('click', displayAssessment);

  const questions = document.querySelectorAll('#q-disability, #q-disease, #q-parent-death, #q-calamity, #q-general');
  questions.forEach(el => {
    el.addEventListener('change', () => {
      const result = document.getElementById('assessment-result');
      if (result) {
        result.style.display = 'none';
        delete result.dataset.tier;
        delete result.dataset.amount;
        delete result.dataset.fee;
        delete result.dataset.label;
      }
    });
  });
});

// =============================================================
// EXPOSE FUNCTIONS GLOBALLY
// =============================================================

window.goToStep = goToStep;
window.displayAssessment = displayAssessment;
window.submitApplicationManual = submitApplicationManual;
