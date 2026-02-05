/**
 * Tenant isolation middleware
 * Ensures proper multitenant separation
 */

import { auditQueries } from '../models/db.js'

/**
 * Log actions for audit trail
 */
export async function auditLog(action, resourceType = null) {
  return async function(request, reply) {
    // Store original send to intercept response
    const originalSend = reply.raw.send

    let statusCode = 200
    reply.raw.send = function(...args) {
      statusCode = reply.raw.statusCode
      return originalSend.apply(this, args)
    }

    // Add hook to log after response
    reply.addHook('onSend', async (request, reply, payload) => {
      try {
        const tenantId = request.tenantId || request.params.tenantId || request.body?.tenantId
        const userId = request.userId

        if (tenantId && userId) {
          await request.pg.query(auditQueries.create, [
            tenantId,
            userId,
            action,
            resourceType,
            request.params.id || request.params.vmId || null,
            JSON.stringify({
              method: request.method,
              path: request.url,
              statusCode
            }),
            request.ip,
            request.headers['user-agent']
          ])
        }
      } catch (err) {
        // Log errors but don't fail the request
        request.log.error({ err }, 'Failed to create audit log')
      }

      return payload
    })
  }
}

/**
 * Validate tenant ownership of a resource
 */
export async function validateResourceOwnership(table, idParam = 'id') {
  return async function(request, reply) {
    const resourceId = request.params[idParam]
    const tenantId = request.tenantId

    const result = await request.pg.query(
      `SELECT tenant_id FROM ${table} WHERE id = $1`,
      [resourceId]
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Resource not found'
      })
    }

    if (result.rows[0].tenant_id !== tenantId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this resource'
      })
    }
  }
}
