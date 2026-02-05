/**
 * CloudClawMac API Server
 * Multitenant backend for provisioning MacStadium Orka VMs
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import postgres from '@fastify/postgres'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import dotenv from 'dotenv'
import { config } from './config/index.js'
import { validateEnv, getSetupStatus } from './config/validate.js'
import { authenticate, optionalAuth, requireTenantAccess, requireCredits } from './middleware/auth.js'
import { setAuthCookie, clearAuthCookie } from './middleware/cookies.js'
import { authRoutes } from './routes/auth.js'
import { vmRoutes } from './routes/vms.js'
import { tenantRoutes } from './routes/tenants.js'
import { healthRoutes } from './routes/health.js'
import { setupRoutes } from './routes/setup.js'
import { jobRoutes } from './routes/jobs.js'
import { auditRoutes } from './routes/audit.js'
import { initBackgroundJobs } from './services/background.js'

// Load and validate environment variables
dotenv.config()

// Validate environment on startup
try {
  validateEnv()
} catch (err) {
  if (err instanceof Error && err.name === 'ValidationError') {
    console.warn('⚠️  Environment validation failed:')
    console.warn('Missing or invalid configuration:')
    err.errors?.forEach(e => console.warn(`  - ${e.path}: ${e.message}`))
    console.warn('\nPlease run the setup wizard or update your .env file')
  }
}

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug'
  },
  trustProxy: true // Trust X-Forwarded-* headers from proxy
})

// Decorate with config
fastify.decorate('config', config)

// Security headers
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

// Register CORS
await fastify.register(cors, {
  origin: config.nodeEnv === 'production'
    ? ['https://cloudclawmac.com', 'https://www.cloudclawmac.com']
    : true,
  credentials: true,
  exposedHeaders: ['set-cookie']
})

// Register cookie support
await fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET || config.jwtSecret
})

// Register JWT
await fastify.register(jwt, {
  secret: config.jwtSecret,
  cookie: {
    cookieName: 'token',
    signed: true
  }
})

// Register rate limiting
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  allowList: ['127.0.0.1', '::1'],
  continueExceeding: true,
  keyGenerator: (request) => {
    // Rate limit by IP, or by user ID if authenticated
    return request.userId || request.ip
  }
})

// Stricter rate limit for auth routes
await fastify.register(async function (fastify) {
  await fastify.register(rateLimit, {
    max: 5,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', '::1'],
    skipOnError: true
  })
}, { prefix: 'auth' })

// Register PostgreSQL
await fastify.register(postgres, {
  connectionString: config.databaseUrl
})

// Decorate with authentication middleware
fastify.decorate('authenticate', authenticate)
fastify.decorate('optionalAuth', optionalAuth)
fastify.decorate('requireTenantAccess', requireTenantAccess)
fastify.decorate('requireCredits', requireCredits)

// Decorate reply with cookie methods
fastify.decorateReply('setAuthCookie', setAuthCookie)
fastify.decorateReply('clearAuthCookie', clearAuthCookie)

// Hook to check cookies for JWT
fastify.addHook('onRequest', async (request, reply) => {
  const cookieToken = request.cookies.token
  if (cookieToken && !request.headers.authorization) {
    request.headers.authorization = `Bearer ${cookieToken}`
  }
})

// Request logging hook
fastify.addHook('preHandler', async (request, reply) => {
  if (request.routeOptions.url) {
    request.log.info({
      method: request.method,
      url: request.url,
      ip: request.ip,
      userId: request.userId
    })
  }
})

// Register routes
await fastify.register(healthRoutes, { prefix: '/health' })
await fastify.register(setupRoutes, { prefix: '/api/setup' })
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(tenantRoutes, { prefix: '/api/tenants' })
await fastify.register(vmRoutes, { prefix: '/api/tenants/:tenantId/vms' })
await fastify.register(auditRoutes, { prefix: '/api/tenants/:tenantId' })
await fastify.register(jobRoutes, { prefix: '/api/jobs' })

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    name: 'CloudClawMac API',
    version: '0.1.0',
    status: 'operational',
    setup: getSetupStatus()
  }
})

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)

  // Handle Zod validation errors
  if (error.code === 'FST_ERR_VALIDATION') {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation
    })
  }

  // Handle JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' && !request.cookies.token) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required'
    })
  }

  // Handle rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: error.headers?.['retry-after']
    })
  }

  // Generic error
  reply.status(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: config.nodeEnv === 'production'
      ? 'An error occurred'
      : (error.message || 'Something went wrong')
  })
})

// Set up timeout handler
fastify.addHook('onTimeout', (request, reply, done) => {
  fastify.log.warn({ url: request.url }, 'Request timed out')
  reply.code(504).send({
    error: 'Gateway Timeout',
    message: 'Request took too long to process'
  })
  done()
})

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.port,
      host: config.host
    })

    fastify.log.info(`Server listening on ${config.host}:${config.port}`)
    fastify.log.info(`Environment: ${config.nodeEnv}`)

    // Initialize background jobs
    initBackgroundJobs(fastify)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// Graceful shutdown
const shutdown = async (signal) => {
  fastify.log.info({ signal }, 'Shutting down...')
  await fastify.close()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

start()
