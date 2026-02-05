/**
 * Security middleware
 * Rate limiting, CSRF protection, etc.
 */

import fp from 'fastify-plugin'

/**
 * Rate limiting configuration
 */
export const rateLimitConfig = {
  max: 100, // Maximum requests per window
  timeWindow: '1 minute', // Time window
  allowList: ['127.0.0.1'], // Always allow localhost
  continueExceeding: true, // Don't stop processing, just add headers
  skipOnError: true, // Don't count errors against rate limit
  keyGenerator: (request) => {
    // Rate limit by IP, or by user ID if authenticated
    return request.userId || request.ip
  },
  errorResponseBuilder: (request, context) => ({
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${context.after}.`,
    retryAfter: context.ttl
  })
}

/**
 * Stricter rate limit for auth endpoints
 */
export const authRateLimitConfig = {
  max: 5, // 5 attempts per minute
  timeWindow: '1 minute',
  allowList: ['127.0.0.1'],
  continueExceeding: true,
  skipOnError: true,
  errorResponseBuilder: (request, context) => ({
    error: 'Too Many Attempts',
    message: 'Too many authentication attempts. Please try again later.',
    retryAfter: context.ttl
  })
}

/**
 * Security headers plugin
 */
export async function securityMiddleware(fastify, options) {
  // Add security headers using Helmet
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })

  // Add rate limiting
  await fastify.register(rateLimit, rateLimitConfig)

  // Add rate limit for auth routes specifically
  await fastify.register(authRateLimit, authRateLimitConfig, { prefix: 'auth-' })

  // Add security-related decorators
  fastify.decorate('security', {
    isTrustedProxy: (request) => {
      // Check if request is from trusted proxy
      const trustedProxies = process.env.TRUSTED_PROXIES?.split(',') || ['127.0.0.1', '::1']
      return trustedProxies.includes(request.ip)
    }
  })
}

// Import the plugins
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import authRateLimit from '@fastify/rate-limit'

export default fp(securityMiddleware, {
  name: 'security-middleware'
})
