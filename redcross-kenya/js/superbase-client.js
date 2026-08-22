// =============================================================
// SUPABASE CLIENT – Shared across pages
// =============================================================

const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getSession() {
  try {
    const data = localStorage.getItem('redcross_session');
    if (data) return JSON.parse(data);
    return null;
  } catch {
    return null;
  }
}

async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    const data = localStorage.getItem('redcross_profile');
    if (data) return JSON.parse(data);
  } catch {}
  return { full_name: user.user_metadata?.full_name || user.email || 'User' };
}

async function requireAuth(redirectTo = 'login.html') {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

async function logoutUser() {
  localStorage.removeItem('redcross_session');
  localStorage.removeItem('redcross_profile');
  window.location.href = 'index.html';
}

window.getSession = getSession;
window.getCurrentUser = getCurrentUser;
window.getCurrentProfile = getCurrentProfile;
window.requireAuth = requireAuth;
window.logoutUser = logoutUser;

async function refreshAuthNav() {
  const authButtons = document.getElementById('auth-buttons');
  const userMenu = document.getElementById('user-menu');
  const userAvatar = document.getElementById('user-avatar');
  if (!authButtons || !userMenu) return;

  const user = await getCurrentUser();
  if (user) {
    authButtons.style.display = 'none';
    userMenu.style.display = 'inline-block';
    if (userAvatar) {
      const name = user.user_metadata?.full_name || user.email || 'U';
      const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
      userAvatar.textContent = initials || 'U';
    }
  } else {
    authButtons.style.display = 'inline-flex';
    userMenu.style.display = 'none';
  }
}

window.refreshAuthNav = refreshAuthNav;
document.addEventListener('DOMContentLoaded', refreshAuthNav);