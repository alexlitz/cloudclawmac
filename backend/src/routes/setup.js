/**
 * Setup routes - First-time setup wizard API
 * Allows configuring the application without touching CLI
 */

import { z } from 'zod'
import bcrypt from 'bcrypt'
import { config } from '../config/index.js'

const setupSchema = z.object({
  // Admin account
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminName: z.string().min(2),

  // Orka configuration
  orkaEndpoint: z.string().url(),
  orkaUsername: z.string().email(),
  orkaPassword: z.string().min(1),

  // SMTP (optional)
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().email().optional(),

  // JWT secret (generated if not provided)
  jwtSecret: z.string().min(16).optional()
})

const validateOrkaSchema = z.object({
  orkaEndpoint: z.string().url(),
  orkaUsername: z.string().email(),
  orkaPassword: z.string().min(1)
})

/**
 * Check if setup is complete
 */
async function isSetupComplete(pg) {
  try {
    const result = await pg.query('SELECT COUNT(*) FROM users')
    // If there are any users, setup is considered complete
    return parseInt(result.rows[0].count) > 0
  } catch {
    return false
  }
}

/**
 * Test Orka connection
 */
async function testOrkaConnection(endpoint, username, password) {
  const { getOrkaClient } = await import('../services/orka.js')
  const orka = new getOrkaClient().constructor({
    endpoint,
    username,
    password
  })

  try {
    const result = await orka.authenticate()
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export async function setupRoutes(fastify, options) {
  // Check setup status
  fastify.get('/status', async (request, reply) => {
    const complete = await isSetupComplete(fastify.pg)

    return {
      setupComplete: complete,
      requiresSetup: !complete
    }
  })

  // Validate Orka credentials
  fastify.post('/validate-orka', async (request, reply) => {
    const body = validateOrkaSchema.parse(request.body)

    const result = await testOrkaConnection(
      body.orkaEndpoint,
      body.orkaUsername,
      body.orkaPassword
    )

    if (!result.success) {
      return reply.status(400).send({
        error: 'Orka connection failed',
        details: result.error
      })
    }

    return {
      success: true,
      message: 'Orka connection successful'
    }
  })

  // Complete setup
  fastify.post('/complete', async (request, reply) => {
    // Check if setup is already complete
    if (await isSetupComplete(fastify.pg)) {
      return reply.status(400).send({
        error: 'Setup already completed'
      })
    }

    const body = setupSchema.parse(request.body)

    try {
      // Test Orka connection first
      const orkaTest = await testOrkaConnection(
        body.orkaEndpoint,
        body.orkaUsername,
        body.orkaPassword
      )

      if (!orkaTest.success) {
        return reply.status(400).send({
          error: 'Orka connection failed',
          details: orkaTest.error
        })
      }

      // Generate JWT secret if not provided
      const jwtSecret = body.jwtSecret || require('crypto').randomBytes(32).toString('base64')

      // Create admin user
      const passwordHash = await bcrypt.hash(body.adminPassword, 10)

      const userResult = await fastify.pg.query(
        `INSERT INTO users (email, password_hash, name)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, created_at`,
        [body.adminEmail, passwordHash, body.adminName]
      )

      const adminUser = userResult.rows[0]

      // Create admin tenant
      const tenantResult = await fastify.pg.query(
        `INSERT INTO tenants (user_id, name, tier, trial_credits, trial_ends_at)
         VALUES ($1, 'admin', 'enterprise', 10000, NOW() + INTERVAL '365 days')
         RETURNING *`,
        [adminUser.id]
      )

      // Generate token
      const token = fastify.jwt.sign({
        sub: adminUser.id,
        email: adminUser.email
      })

      return {
        success: true,
        message: 'Setup completed successfully',
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name
        },
        tenant: tenantResult.rows[0],
        token,
        configSaved: {
          orkaEndpoint: body.orkaEndpoint,
          jwtSecret: jwtSecret
        },
        nextSteps: [
          'Save the configuration values below to your .env file',
          'Create an admin account has been created for you',
          'You can now login and start provisioning VMs'
        ],
        envTemplate: `
# Add these to your .env file:
ORKA_ENDPOINT=${body.orkaEndpoint}
ORKA_USERNAME=${body.orkaUsername}
ORKA_PASSWORD=${body.orkaPassword}
JWT_SECRET=${jwtSecret}
${body.smtpHost ? `
# SMTP Configuration
SMTP_HOST=${body.smtpHost}
SMTP_PORT=${body.smtpPort || 587}
SMTP_USER=${body.smtpUser}
SMTP_PASS=${body.smtpPass}
SMTP_FROM=${body.smtpFrom}` : ''}
        `.trim()
      }

    } catch (err) {
      fastify.log.error({ err }, 'Setup failed')
      return reply.status(500).send({
        error: 'Setup failed',
        message: err.message
      })
    }
  })

  // Get system requirements for setup UI
  fastify.get('/requirements', async (request, reply) => {
    return {
      orka: {
        endpoint: config.orka.endpoint,
        requiredFields: ['endpoint', 'username', 'password']
      },
      admin: {
        requiredFields: ['email', 'password', 'name']
      },
      optional: {
        smtp: ['host', 'port', 'username', 'password', 'from']
      }
    }
  })
}
