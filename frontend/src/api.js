const API_BASE = '/api'

// Helper to make API calls
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token')

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'API request failed')
  }

  return data
}

// Auth API
export const authApi = {
  register: (email, password, name) =>
    apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    }),

  login: (email, password) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  refresh: () =>
    apiCall('/auth/refresh', { method: 'POST' })
}

// Tenants API
export const tenantApi = {
  getAll: () => apiCall('/tenants'),
  create: (name) =>
    apiCall('/tenants', {
      method: 'POST',
      body: JSON.stringify({ name })
    }),
  getDetails: (tenantId) => apiCall(`/tenants/${tenantId}`),
  updateTier: (tenantId, tier) =>
    apiCall(`/tenants/${tenantId}/tier`, {
      method: 'PATCH',
      body: JSON.stringify({ tier })
    }),
  getPricing: () => apiCall('/tenants/pricing/info')
}

// VMs API
export const vmApi = {
  list: (tenantId) => apiCall(`/tenants/${tenantId}/vms`),
  create: (tenantId, options) =>
    apiCall(`/tenants/${tenantId}/vms`, {
      method: 'POST',
      body: JSON.stringify(options)
    }),
  get: (tenantId, vmId) => apiCall(`/tenants/${tenantId}/vms/${vmId}`),
  start: (tenantId, vmId) =>
    apiCall(`/tenants/${tenantId}/vms/${vmId}/start`, { method: 'POST' }),
  stop: (tenantId, vmId) =>
    apiCall(`/tenants/${tenantId}/vms/${vmId}/stop`, { method: 'POST' }),
  delete: (tenantId, vmId) =>
    apiCall(`/tenants/${tenantId}/vms/${vmId}`, { method: 'DELETE' }),
  getConnection: (tenantId, vmId) =>
    apiCall(`/tenants/${tenantId}/vms/${vmId}/connect`)
}
