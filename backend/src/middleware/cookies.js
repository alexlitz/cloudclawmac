/**
 * Cookie-based JWT storage (more secure than localStorage)
 */

import fp from 'fastify-plugin'

export const cookieOptions = {
  httpOnly: true, // Not accessible via JavaScript (prevents XSS)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict', // CSRF protection
  path: '/',
  maxAge: 60 * 60 * 24 * 7 // 7 days
}

/**
 * Set auth cookie on reply
 */
export function setAuthCookie(token) {
  return this.cookie('token', token, cookieOptions)
}

/**
 * Clear auth cookie from reply
 */
export function clearAuthCookie() {
  return this.clearCookie('token', { path: '/' })
}

/**
 * Cookie authentication plugin
 */
export async function cookieAuthPlugin(fastify, options) {
  // Register cookie support
  await fastify.register(import('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET
  })

  // Decorate reply with methods to set/get auth cookies
  fastify.decorateReply('setAuthCookie', setAuthCookie)
  fastify.decorateReply('clearAuthCookie', clearAuthCookie)

  fastify.decorateRequest('getAuthToken', function() {
    // Try cookie first, then Authorization header
    return this.cookies.token || this.headers?.authorization?.replace('Bearer ', '')
  })
}

export default fp(cookieAuthPlugin, {
  name: 'cookie-auth'
})
