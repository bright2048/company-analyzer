const BASE = '';

function getToken() {
  return localStorage.getItem('token') || '';
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

function authHeaders() {
  return { 'Authorization': `Bearer ${getToken()}` };
}

function adminHeaders() {
  return { 'X-Platform-Admin-Token': getPlatformToken() };
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
  profile: () => request('/api/v1/user/profile', { headers: authHeaders() }),
  wallet: () => request('/api/v1/user/wallet', { headers: authHeaders() }),
  usage: () => request('/api/v1/user/usage', { headers: authHeaders() }),
  usageSummary: () => request('/api/v1/user/usage/summary', { headers: authHeaders() }),
  createKey: (name) => request('/api/v1/user/apikeys', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name }) }),
  listKeys: () => request('/api/v1/user/apikeys', { headers: authHeaders() }),
  deleteKey: (id) => request(`/api/v1/user/apikeys?id=${id}`, { method: 'DELETE', headers: authHeaders() }),
  purchase: (planId) => request('/api/v1/user/purchase', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ plan_id: planId }) }),
  redeemCoupon: (code) => request('/api/v1/user/coupon/redeem', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ code }) }),
  subscriptions: () => request('/api/v1/user/subscriptions', { headers: authHeaders() }),
};

// Market (模型超市)
export const market = {
  products: (params) => request(`/api/v1/market/products?${new URLSearchParams(params || {})}`),
  product: (id) => request(`/api/v1/market/product?id=${id}`),
  filters: () => request('/api/v1/market/filters'),
  subscribe: (modelPlanId) => request('/api/v1/market/subscribe', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ model_plan_id: modelPlanId }) }),
};

// Plans (充值包)
export const plans = {
  list: () => request('/api/v1/plans'),
};

// Admin
export const admin = {
  overview: () => request('/api/admin/overview', { headers: adminHeaders() }),
  users: () => request('/api/admin/users', { headers: adminHeaders() }),
  adjustBalance: (userId, amountFen, reason) =>
    request('/api/admin/users/adjust-balance', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ user_id: userId, amount_fen: amountFen, reason }) }),
  suppliers: () => request('/api/admin/suppliers', { headers: adminHeaders() }),
  createSupplier: (data) => request('/api/admin/suppliers', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(data) }),
  updateSupplier: (data) => request('/api/admin/suppliers', { method: 'PUT', headers: adminHeaders(), body: JSON.stringify(data) }),
  deleteSupplier: (id) => request(`/api/admin/suppliers?id=${id}`, { method: 'DELETE', headers: adminHeaders() }),
  plans: () => request('/api/admin/plans', { headers: adminHeaders() }),
  createPlan: (data) => request('/api/admin/plans', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(data) }),
  coupons: () => request('/api/admin/coupons', { headers: adminHeaders() }),
  createCoupon: (data) => request('/api/admin/coupons', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(data) }),
  modelProducts: () => request('/api/admin/model-products', { headers: adminHeaders() }),
  createModelProduct: (data) => request('/api/admin/model-products', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(data) }),
  modelPlans: (productId) => request(`/api/admin/model-plans?product_id=${productId}`, { headers: adminHeaders() }),
  createModelPlan: (data) => request('/api/admin/model-plans', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(data) }),
};
