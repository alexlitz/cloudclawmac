/**
 * Authentication routes
 * Register, login, token refresh, logout
 */

import { z } from 'zod'
import bcrypt from 'bcrypt'
import { userQueries, tenantQueries } from '../models/db.js'

// Password complexity regex: at least 8 chars, 1 letter, 1 number
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(passwordRegex, 'Password must contain at least 1 letter and 1 number'),
  name: z.string().min(2).optional()
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

export async function authRoutes(fastify, options) {
  // Rate limit auth endpoints
  fastify.register(async function (instance) {
    // Register new user
    instance.post('/register', async (request, reply) => {
      try {
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

        // Create user and tenant in a transaction
        const client = await fastify.pg.connect()
        try {
          await client.query('BEGIN')

          // Create user
          const userResult = await client.query(
            userQueries.create,
            [body.email, passwordHash, body.name || body.email.split('@')[0]]
          )
          const user = userResult.rows[0]

          // Create default tenant
          const tenantResult = await client.query(
            tenantQueries.create,
            [user.id, 'default', 'standard', fastify.config.trial.credits]
          )
          const tenant = tenantResult.rows[0]

          await client.query('COMMIT')

          // Generate JWT
          const token = fastify.jwt.sign({
            sub: user.id,
            email: user.email
          })

          // Set httpOnly cookie
          reply.setAuthCookie(token)

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
            }
          })
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
      } catch (err) {
        if (err.name === 'ZodError') {
          return reply.status(400).send({
            error: 'Validation Error',
            details: err.errors
          })
        }
        throw err
      }
    })

    // Login
    instance.post('/login', async (request, reply) => {
      try {
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

        // Set httpOnly cookie
        reply.setAuthCookie(token)

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
          }))
        }
      } catch (err) {
        if (err.name === 'ZodError') {
          return reply.status(400).send({
            error: 'Validation Error',
            details: err.errors
          })
        }
        throw err
      }
    })

    // Logout
    instance.post('/logout', async (request, reply) => {
      reply.clearAuthCookie()
      return { message: 'Logged out successfully' }
    })
  }, { prefix: '/auth' })

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

    // Set new cookie
    reply.setAuthCookie(token)

    return { success: true }
  })

  // Get current user
  fastify.get('/me', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const userResult = await fastify.pg.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [request.userId]
    )

    if (userResult.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found'
      })
    }

    const user = userResult.rows[0]

    // Get user's tenants
    const tenantResult = await fastify.pg.query(
      tenantQueries.findByUserId,
      [user.id]
    )

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at
      },
      tenants: tenantResult.rows.map(t => ({
        id: t.id,
        name: t.name,
        tier: t.tier,
        trialCredits: t.trial_credits,
        trialEndsAt: t.trial_ends_at
      }))
    }
  })
}
