/**
 * Authentication and authorization middleware
 */

import { fastify } from 'fastify'
import { config } from '../config/index.js'

/**
 * Verify JWT token
 */
export async function authenticate(request, reply) {
  try {
    await request.jwtVerify()
  } catch (err) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token'
    })
  }

  // Attach user_id from JWT payload
  request.userId = request.user.sub
}

/**
 * Verify tenant access - ensures user can only access their own resources
 */
export async function requireTenantAccess(request, reply) {
  const { tenantId } = request.params

  // Get user's tenants
  const result = await request.pg.query(
    'SELECT id FROM tenants WHERE id = $1 AND user_id = $2',
    [tenantId, request.userId]
  )

  if (result.rows.length === 0) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'You do not have access to this tenant'
    })
  }

  request.tenantId = tenantId
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(request, reply) {
  try {
    await request.jwtVerify()
    request.userId = request.user.sub
    request.isAuthenticated = true
  } catch (err) {
    request.isAuthenticated = false
  }
}

/**
 * Check if user has remaining trial credits or active subscription
 */
export async function requireCredits(request, reply) {
  const { tenantId } = request.params

  const result = await request.pg.query(
    `SELECT trial_credits, tier, trial_ends_at
     FROM tenants
     WHERE id = $1`,
    [tenantId]
  )

  if (result.rows.length === 0) {
    return reply.status(404).send({
      error: 'Not Found',
      message: 'Tenant not found'
    })
  }

  const tenant = result.rows[0]
  const hasTrialCredits = tenant.trial_credits > 0
  const hasActiveSubscription = ['pro', 'enterprise'].includes(tenant.tier)
  const trialIsActive = tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date()

  if (!hasTrialCredits && !hasActiveSubscription && !trialIsActive) {
    return reply.status(402).send({
      error: 'Payment Required',
      message: 'No credits remaining. Please upgrade to continue.',
      canTrial: false
    })
  }

  request.tenant = tenant
}
