/**
 * API client with proper cookie support and error handling
 */

// Base API URL
const API_BASE = '/api'

// Error classes for better error handling
export class APIError extends Error {
  constructor(status, message, details = null) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.details = details
  }
}

export class AuthError extends APIError {
  constructor(message = 'Authentication required') {
    super(401, message)
    this.name = 'AuthError'
  }
}

/**
 * Make API call with proper error handling and cookie support
 */
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include' // Important: send cookies
  }

  try {
    const response = await fetch(url, config)
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      // Handle specific status codes
      switch (response.status) {
        case 401:
        case 403:
          // Clear invalid token and redirect to login
          if (window.location.pathname !== '/login') {
            localStorage.removeItem('user')
            localStorage.removeItem('tenants')
            window.location.href = '/login'
          }
          throw new AuthError(data?.message || 'Authentication required')

        case 429:
          throw new APIError(429, 'Rate limit exceeded. Please try again later.', {
            retryAfter: response.headers.get('retry-after')
          })

        case 402:
          throw new APIError(402, data?.message || 'Payment required', data)

        case 404:
          throw new APIError(404, data?.message || 'Resource not found')

        case 409:
          throw new APIError(409, data?.message || 'Resource already exists')

        case 400:
          throw new APIError(400, data?.message || 'Invalid request', data?.details)

        case 500:
        case 502:
        case 503:
        case 504:
          throw new APIError(response.status, 'Service temporarily unavailable')

        default:
          throw new APIError(response.status, data?.message || 'API request failed')
      }
    }

    return data
  } catch (err) {
    // Re-throw API errors
    if (err instanceof APIError) {
      throw err
    }

    // Network or other errors
    throw new APIError(0, 'Network error. Please check your connection.')
  }
}

/**
 * Auth API
 */
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

  logout: () =>
    apiCall('/auth/logout', {
      method: 'POST'
    }),

  refresh: () =>
    apiCall('/auth/refresh', { method: 'POST' }),

  me: () =>
    apiCall('/auth/me', { method: 'GET' })
}

/**
 * Tenants API
 */
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

/**
 * VMs API
 */
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

/**
 * Setup API
 */
export const setupApi = {
  getStatus: () => apiCall('/setup/status'),

  validateOrka: (endpoint, username, password) =>
    apiCall('/setup/validate-orka', {
      method: 'POST',
      body: JSON.stringify({ orkaEndpoint: endpoint, orkaUsername: username, orkaPassword: password })
    }),

  complete: (data) =>
    apiCall('/setup/complete', {
      method: 'POST',
      body: JSON.stringify(data)
    })
}

/**
 * Jobs API
 */
export const jobApi = {
  getStatus: () => apiCall('/jobs/status'),

  triggerCleanup: () =>
    apiCall('/jobs/cleanup', { method: 'POST' })
}
