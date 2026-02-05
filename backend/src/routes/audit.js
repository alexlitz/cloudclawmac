/**
 * Audit log routes
 * View security and activity logs
 */

import { z } from 'zod'
import { auditQueries } from '../models/db.js'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
})

export async function auditRoutes(fastify, options) {
  // Get audit logs for a tenant
  fastify.get('/:tenantId/logs', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess]
  }, async (request, reply) => {
    const { tenantId } = request.params
    const { page, limit } = paginationSchema.parse(request.query)

    const offset = (page - 1) * limit

    // Get total count
    const countResult = await fastify.pg.query(
      'SELECT COUNT(*) as total FROM audit_logs WHERE tenant_id = $1',
      [tenantId]
    )

    const total = parseInt(countResult.rows[0].total)

    // Get logs with pagination
    const logsResult = await fastify.pg.query(
      `SELECT * FROM audit_logs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    )

    return {
      logs: logsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  })

  // Get user activity
  fastify.get('/:tenantId/activity', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess]
  }, async (request, reply) => {
    const { tenantId } = request.params
    const { days = 30 } = request.query

    const result = await fastify.pg.query(
      `SELECT
         action,
         COUNT(*) as count,
         MAX(created_at) as last_occurred
       FROM audit_logs
       WHERE tenant_id = $1
         AND created_at > NOW() - INTERVAL '1 day' * $2
       GROUP BY action
       ORDER BY count DESC`,
      [tenantId, days]
    )

    return {
      activities: result.rows
    }
  })
}
