const BASE = '';

function getToken() {
  return localStorage.getItem('kp_admin_token') || '';
}

function getPlatformToken() {
  return localStorage.getItem('kp_platform_token') || '';
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(BASE + url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Auth
export const auth = {
  register: (email, password, company) =>
    request('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ email, password, company }) }),
  login: (email, password) =>
    request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
};

// User
export const user = {
  profile: () => request('/api/v1/user/profile', { headers: { 'X-Admin-Token': getToken() } }),
  wallet: () => request('/api/v1/user/wallet', { headers: { 'X-Admin-Token': getToken() } }),
  usage: () => request('/api/v1/user/usage', { headers: { 'X-Admin-Token': getToken() } }),
  usageSummary: () => request('/api/v1/user/usage/summary', { headers: { 'X-Admin-Token': getToken() } }),
  createKey: (name) => request('/api/v1/user/apikeys', { method: 'POST', headers: { 'X-Admin-Token': getToken() }, body: JSON.stringify({ name }) }),
  listKeys: () => request('/api/v1/user/apikeys', { headers: { 'X-Admin-Token': getToken() } }),
  deleteKey: (id) => request(`/api/v1/user/apikeys?id=${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': getToken() } }),
  purchase: (planId) => request('/api/v1/user/purchase', { method: 'POST', headers: { 'X-Admin-Token': getToken() }, body: JSON.stringify({ plan_id: planId }) }),
  redeemCoupon: (code) => request('/api/v1/user/coupon/redeem', { method: 'POST', headers: { 'X-Admin-Token': getToken() }, body: JSON.stringify({ code }) }),
};

// Plans
export const plans = {
  list: () => request('/api/v1/plans'),
};

// Admin
export const admin = {
  overview: () => request('/api/admin/overview', { headers: { 'X-Platform-Admin-Token': getPlatformToken() } }),
  users: () => request('/api/admin/users', { headers: { 'X-Platform-Admin-Token': getPlatformToken() } }),
  adjustBalance: (userId, amountFen, reason) =>
    request('/api/admin/users/adjust-balance', { method: 'POST', headers: { 'X-Platform-Admin-Token': getPlatformToken() }, body: JSON.stringify({ user_id: userId, amount_fen: amountFen, reason }) }),
  suppliers: () => request('/api/admin/suppliers', { headers: { 'X-Platform-Admin-Token': getPlatformToken() } }),
  createSupplier: (data) => request('/api/admin/suppliers', { method: 'POST', headers: { 'X-Platform-Admin-Token': getPlatformToken() }, body: JSON.stringify(data) }),
  updateSupplier: (data) => request('/api/admin/suppliers', { method: 'PUT', headers: { 'X-Platform-Admin-Token': getPlatformToken() }, body: JSON.stringify(data) }),
  deleteSupplier: (id) => request(`/api/admin/suppliers?id=${id}`, { method: 'DELETE', headers: { 'X-Platform-Admin-Token': getPlatformToken() } }),
  plans: () => request('/api/admin/plans', { headers: { 'X-Platform-Admin-Token': getPlatformToken() } }),
  createPlan: (data) => request('/api/admin/plans', { method: 'POST', headers: { 'X-Platform-Admin-Token': getPlatformToken() }, body: JSON.stringify(data) }),
  coupons: () => request('/api/admin/coupons', { headers: { 'X-Platform-Admin-Token': getPlatformToken() } }),
  createCoupon: (data) => request('/api/admin/coupons', { method: 'POST', headers: { 'X-Platform-Admin-Token': getPlatformToken() }, body: JSON.stringify(data) }),
};
