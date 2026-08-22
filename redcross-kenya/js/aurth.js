// =============================================================
// AUTH — NO RESTRICTIONS (any email/password works)
// =============================================================

function showAuthError(elId, message) {
  const el = document.getElementById(elId);
  el.textContent = message;
  el.classList.add('show');
}

function showAuthSuccess(elId, message) {
  const el = document.getElementById(elId);
  el.textContent = message;
  el.classList.add('show');
}

function clearAuthMessages() {
  document.querySelectorAll('.form-error, .form-success').forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
}

function setBtnLoading(btnId, loadingText) {
  const btn = document.getElementById(btnId);
  btn.dataset.originalText = btn.dataset.originalText || btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner spinner--light"></span> ${loadingText}`;
}

function setBtnNormal(btnId) {
  const btn = document.getElementById(btnId);
  btn.disabled = false;
  btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
}

function showSignupTab() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('signup-form').style.display = 'block';
  document.getElementById('tab-login').classList.remove('active');
  document.getElementById('tab-signup').classList.add('active');
  clearAuthMessages();
}

function showLoginTab() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('tab-login').classList.add('active');
  document.getElementById('tab-signup').classList.remove('active');
  clearAuthMessages();
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  clearAuthMessages();

  if (!email || !password) {
    showAuthError('login-error', 'Please enter both email and password.');
    return;
  }

  setBtnLoading('login-btn', 'Logging in...');

  try {
    const userData = {
      id: crypto.randomUUID(),
      email: email,
      user_metadata: {
        full_name: email.split('@')[0] || 'User'
      }
    };

    localStorage.setItem('redcross_session', JSON.stringify({
      access_token: 'dummy_token_' + Date.now(),
      user: userData
    }));

    try {
      await window.supabaseClient.from('profiles').upsert({
        id: userData.id,
        email: email,
        full_name: userData.user_metadata.full_name
      });
    } catch (dbErr) {
      console.log('Profile creation skipped (non-blocking):', dbErr.message);
    }

    setBtnNormal('login-btn');
    window.location.href = 'dashboard.html';

  } catch (error) {
    setBtnNormal('login-btn');
    showAuthError('login-error', 'Login failed. Please try again.');
  }
}

async function handleSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const password = document.getElementById('signup-password').value;

  clearAuthMessages();

  if (!name || !email || !phone || !password) {
    showAuthError('signup-error', 'Please fill in all fields.');
    return;
  }

  setBtnLoading('signup-btn', 'Creating account...');

  try {
    const userData = {
      id: crypto.randomUUID(),
      email: email,
      user_metadata: {
        full_name: name,
        phone: phone
      }
    };

    localStorage.setItem('redcross_session', JSON.stringify({
      access_token: 'dummy_token_' + Date.now(),
      user: userData
    }));

    localStorage.setItem('redcross_profile', JSON.stringify({
      full_name: name,
      phone: phone,
      email: email
    }));

    try {
      await window.supabaseClient.from('profiles').upsert({
        id: userData.id,
        email: email,
        full_name: name,
        phone: phone
      });
    } catch (dbErr) {
      console.log('Profile creation skipped (non-blocking):', dbErr.message);
    }

    setBtnNormal('signup-btn');
    showAuthSuccess('signup-error'.replace('error', 'success'), 'Account created! Welcome!');
    
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1000);

  } catch (error) {
    setBtnNormal('signup-btn');
    showAuthError('signup-error', 'Sign up failed. Please try again.');
  }
}

window.showSignupTab = showSignupTab;
window.showLoginTab = showLoginTab;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;