// =============================================================
// DASHBOARD.JS – Aid applications with tier & status
// =============================================================

function statusPill(status) {
  const map = {
    pending_payment: { label: '⏳ Payment pending', cls: 'pill--pending' },
    pending_review: { label: '🔍 Under review', cls: 'pill--pending' },
    reviewing: { label: '📋 Reviewing', cls: 'pill--pending' },
    approved: { label: '✅ Approved', cls: 'pill--active' },
    active: { label: '🟢 Active', cls: 'pill--active' },
    delivered: { label: '📦 Aid delivered', cls: 'pill--active' },
    rejected: { label: '❌ Rejected', cls: 'pill--failed' },
    closed: { label: '🔒 Closed', cls: 'pill--cancelled' }
  };
  const meta = map[status] || map.pending;
  return `<span class="pill ${meta.cls}">${meta.label}</span>`;
}

function daysRemaining(expiresAt) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  if (diff < 0) return '⏰ Expired';
  if (diff === 0) return '⚠️ Expires today';
  if (diff === 1) return '⚠️ 1 day remaining';
  return `⏳ ${diff} days remaining`;
}

function getTierLabel(tier) {
  const map = {
    1: 'Tier 1: General Hardship',
    2: 'Tier 2: Natural Calamity',
    3: 'Tier 3: Disease',
    4: 'Tier 4: Loss of Parent',
    5: 'Tier 5: Severe Disability'
  };
  return map[tier] || `Tier ${tier}`;
}

function fmtMoney(n) {
  return 'KES ' + Number(n || 0).toLocaleString('en-KE');
}

async function loadDashboard() {
  const user = window.requireAuth('login.html?next=dashboard.html');
  if (!user) return;

  const name = user.user_metadata?.full_name || user.email || 'Friend';
  document.getElementById('dash-name').textContent = name;

  const { data: apps, error } = await window.supabaseClient
    .from('aid_applications')
    .select('*')
    .eq('email', user.email)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    document.getElementById('applications-list').innerHTML =
      `<div class="empty-state">Could not load applications.</div>`;
    return;
  }

  const total = apps.length;
  const pending = apps.filter(a => a.status === 'pending_payment' || a.status === 'pending_review' || a.status === 'reviewing').length;
  const approved = apps.filter(a => a.status === 'approved' || a.status === 'active' || a.status === 'delivered').length;

  document.getElementById('total-apps').textContent = total;
  document.getElementById('pending-apps').textContent = pending;
  document.getElementById('approved-apps').textContent = approved;

  const container = document.getElementById('applications-list');

  if (!apps || apps.length === 0) {
    container.innerHTML = `<div class="empty-state">You haven't submitted any aid applications yet.</div>`;
    return;
  }

  container.innerHTML = apps.map(a => `
    <div class="card" style="margin-bottom:12px; padding:18px 20px; border-left: 4px solid ${a.status === 'active' || a.status === 'approved' ? 'var(--teal)' : a.status === 'pending_payment' ? 'var(--warning)' : 'var(--border)'};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
        <div>
          <h3 style="font-size:15px;">${getTierLabel(a.tier)}</h3>
          <p style="font-size:13px; color:var(--text-muted);">${a.location}</p>
          <p style="font-size:12px; color:var(--text-faint);">${a.full_name}</p>
        </div>
        <div style="text-align:right;">
          <div>${statusPill(a.status)}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
            ${a.status === 'active' ? '🟢 Monthly aid active' : daysRemaining(a.expires_at)}
          </div>
        </div>
      </div>
      <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border-soft); display:flex; justify-content:space-between; font-size:13px; flex-wrap:wrap; gap:8px;">
        <span style="color:var(--text-muted);">Applied: ${new Date(a.created_at).toLocaleDateString()}</span>
        <span><strong style="color:var(--accent);">Monthly aid: ${fmtMoney(a.aid_amount)}</strong></span>
        <span><span style="color:var(--text-faint);">Fee paid: </span><strong>${fmtMoney(a.registration_fee)}</strong></span>
      </div>
      ${a.admin_notes ? `<div style="margin-top:8px; font-size:12px; color:var(--text-muted); background:var(--bg-elevated); padding:8px 12px; border-radius:6px;">📝 ${a.admin_notes}</div>` : ''}
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadDashboard);