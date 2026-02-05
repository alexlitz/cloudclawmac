/**
 * Test helper functions
 */

import Fastify from 'fastify'
import postgres from 'pg'
import dotenv from 'dotenv'

dotenv.config()

export async function build(options = {}) {
  const app = Fastify({
    logger: false // Disable logging in tests
  })

  // Register routes
  await app.register(import('../src/routes/auth.js'), { prefix: '/api/auth' })

  // Mock PostgreSQL for testing
  const pool = new postgres.Pool({
    database: 'cloudclawmac_test',
    user: 'postgres',
    password: 'postgres',
    max: 1
  })

  app.decorate('pg', pool)
  app.decorate('config', {
    jwtSecret: 'test-secret',
    trial: { credits: 500 }
  })

  // Register JWT
  await app.register(import('@fastify/jwt'), {
    secret: 'test-secret'
  })

  await app.register(import('@fastify/cookie'), {
    secret: 'test-secret'
  })

  // Decorate with auth middleware
  await app.register(import('../src/middleware/auth.js'))

  // Decorate reply with cookie methods
  await app.register(import('../src/middleware/cookies.js'))

  await app.ready()

  return app
}
