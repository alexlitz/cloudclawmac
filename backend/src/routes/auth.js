/**
 * Authentication routes
 * Register, login, token refresh
 */

import { z } from 'zod'
import bcrypt from 'bcrypt'
import { userQueries, tenantQueries } from '../models/db.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).optional()
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

export async function authRoutes(fastify, options) {
  // Register new user
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)

    // Check if user exists
    const existingUser = await fastify.pg.query(
      userQueries.findByEmail,
      [body.email]
    )

    if (existingUser.rows.length > 0) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'User already exists'
      })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10)

    // Create user
    const userResult = await fastify.pg.query(
      userQueries.create,
      [body.email, passwordHash, body.name || body.email.split('@')[0]]
    )

    const user = userResult.rows[0]

    // Create default tenant
    const tenantResult = await fastify.pg.query(
      tenantQueries.create,
      [user.id, 'default', 'standard', fastify.config.trial.credits]
    )

    const tenant = tenantResult.rows[0]

    // Generate JWT
    const token = fastify.jwt.sign({
      sub: user.id,
      email: user.email
    })

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        tier: tenant.tier,
        trialCredits: tenant.trial_credits,
        trialEndsAt: tenant.trial_ends_at
      },
      token
    })
  })

  // Login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    // Find user
    const userResult = await fastify.pg.query(
      userQueries.findByEmail,
      [body.email]
    )

    if (userResult.rows.length === 0) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      })
    }

    const user = userResult.rows[0]

    // Verify password
    const validPassword = await bcrypt.compare(body.password, user.password_hash)
    if (!validPassword) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      })
    }

    // Get user's tenants
    const tenantResult = await fastify.pg.query(
      tenantQueries.findByUserId,
      [user.id]
    )

    // Generate JWT
    const token = fastify.jwt.sign({
      sub: user.id,
      email: user.email
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tenants: tenantResult.rows.map(t => ({
        id: t.id,
        name: t.name,
        tier: t.tier,
        trialCredits: t.trial_credits,
        trialEndsAt: t.trial_ends_at
      })),
      token
    }
  })

  // Refresh token
  fastify.post('/refresh', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const userResult = await fastify.pg.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [request.userId]
    )

    if (userResult.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found'
      })
    }

    const user = userResult.rows[0]

    const token = fastify.jwt.sign({
      sub: user.id,
      email: user.email
    })

    return { token }
  })
}
