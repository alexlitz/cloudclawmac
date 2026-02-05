/**
 * Tenant routes
 * Manage tenants, usage, billing info
 */

import { z } from 'zod'
import { tenantQueries } from '../models/db.js'

const createTenantSchema = z.object({
  name: z.string().min(2).max(50)
})

export async function tenantRoutes(fastify, options) {
  // Get all user's tenants
  fastify.get('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const result = await fastify.pg.query(
      tenantQueries.findByUserId,
      [request.userId]
    )

    return {
      tenants: result.rows
    }
  })

  // Create new tenant
  fastify.post('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const body = createTenantSchema.parse(request.body)

    const result = await fastify.pg.query(
      'INSERT INTO tenants (user_id, name, tier, trial_credits, trial_ends_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL $5) RETURNING *',
      [request.userId, body.name, 'standard', fastify.config.trial.credits, `${fastify.config.trial.durationDays} days`]
    )

    return reply.status(201).send({
      tenant: result.rows[0]
    })
  })

  // Get tenant details with usage
  fastify.get('/:tenantId', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess]
  }, async (request, reply) => {
    const tenantResult = await fastify.pg.query(
      tenantQueries.findById,
      [request.tenantId]
    )

    const usageResult = await fastify.pg.query(
      tenantQueries.getUsageStats,
      [request.tenantId]
    )

    const tenant = tenantResult.rows[0]
    const usage = usageResult.rows[0]

    return {
      tenant: {
        ...tenant,
        usage: {
          totalVMs: parseInt(usage.total_vms),
          runningVMs: parseInt(usage.running_vms),
          totalSeconds: parseInt(usage.total_seconds),
          totalCostCents: parseInt(usage.total_cost_cents)
        }
      }
    }
  })

  // Update tenant tier
  fastify.patch('/:tenantId/tier', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess]
  }, async (request, reply) => {
    const { tier } = request.body

    if (!['standard', 'pro', 'enterprise'].includes(tier)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid tier'
      })
    }

    const result = await fastify.pg.query(
      tenantQueries.updateTier,
      [request.tenantId, tier]
    )

    return {
      tenant: result.rows[0]
    }
  })

  // Get pricing info
  fastify.get('/pricing/info', {
    onRequest: [fastify.optionalAuth]
  }, async (request, reply) => {
    return {
      pricing: {
        standard: {
          name: 'Standard',
          priceCentsPerHour: 500,
          priceMonthly: 2999,
          features: [
            '1 concurrent VM',
            '4 vCPUs',
            '14GB RAM',
            'Community support'
          ]
        },
        pro: {
          name: 'Pro',
          priceCentsPerHour: 1000,
          priceMonthly: 4999,
          features: [
            '3 concurrent VMs',
            '6 vCPUs',
            '28GB RAM',
            'Priority support',
            'Snapshots'
          ]
        },
        enterprise: {
          name: 'Enterprise',
          priceCentsPerHour: 2000,
          priceMonthly: 9999,
          features: [
            '10 concurrent VMs',
            '12 vCPUs',
            '56GB RAM',
            'Dedicated support',
            'Custom images',
            'API access'
          ]
        }
      },
      trial: {
        credits: fastify.config.trial.credits,
        durationDays: fastify.config.trial.durationDays
      }
    }
  })
}
