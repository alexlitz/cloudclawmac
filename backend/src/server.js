/**
 * CloudClawMac API Server
 * Multitenant backend for provisioning MacStadium Orka VMs
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import postgres from '@fastify/postgres'
import dotenv from 'dotenv'
import { config } from './config/index.js'
import { authenticate, optionalAuth, requireTenantAccess, requireCredits } from './middleware/auth.js'
import { authRoutes } from './routes/auth.js'
import { vmRoutes } from './routes/vms.js'
import { tenantRoutes } from './routes/tenants.js'
import { healthRoutes } from './routes/health.js'
import { setupRoutes } from './routes/setup.js'

// Load environment variables
dotenv.config()

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug'
  }
})

// Decorate with config
fastify.decorate('config', config)

// Register plugins
await fastify.register(cors, {
  origin: config.nodeEnv === 'production'
    ? ['https://cloudclawmac.com'] // Add your domain
    : true, // Allow all in development
  credentials: true
})

await fastify.register(jwt, {
  secret: config.jwtSecret
})

await fastify.register(postgres, {
  connectionString: config.databaseUrl
})

// Decorate with authentication middleware
fastify.decorate('authenticate', authenticate)
fastify.decorate('optionalAuth', optionalAuth)
fastify.decorate('requireTenantAccess', requireTenantAccess)
fastify.decorate('requireCredits', requireCredits)

// Register routes
await fastify.register(healthRoutes, { prefix: '/health' })
await fastify.register(setupRoutes, { prefix: '/api/setup' })
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(tenantRoutes, { prefix: '/api/tenants' })
await fastify.register(vmRoutes, { prefix: '/api/tenants/:tenantId/vms' })

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    name: 'CloudClawMac API',
    version: '0.1.0',
    status: 'operational'
  }
})

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)

  // Handle Zod validation errors
  if (error.code === 'FST_ERR_VALIDATION') {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message
    })
  }

  // Handle JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing authorization header'
    })
  }

  reply.status(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message || 'Something went wrong'
  })
})

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.port,
      host: config.host
    })

    fastify.log.info(`Server listening on ${config.host}:${config.port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
