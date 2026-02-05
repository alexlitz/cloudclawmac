/**
 * Health check routes
 */

export async function healthRoutes(fastify, options) {
  // Basic health check
  fastify.get('/', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'cloudclawmac-api'
    }
  })

  // Detailed health with dependencies
  fastify.get('/detailed', async (request, reply) => {
    const checks = {
      api: { status: 'ok' },
      database: { status: 'unknown' },
      orka: { status: 'unknown' }
    }

    // Check database
    try {
      const result = await fastify.pg.query('SELECT 1')
      checks.database = { status: 'ok', latency: result.duration }
    } catch (err) {
      checks.database = { status: 'error', message: err.message }
    }

    // Check Orka (optional - don't fail on Orka issues)
    try {
      const { getOrkaClient } = await import('../services/orka.js')
      const orka = getOrkaClient()
      const result = await orka.getHealth()
      checks.orka = {
        status: result.ok ? 'ok' : 'error',
        message: result.error
      }
    } catch (err) {
      checks.orka = { status: 'error', message: err.message }
    }

    const allHealthy = Object.values(checks).every(c => c.status === 'ok')

    reply.code(allHealthy ? 200 : 503)
    return {
      status: allHealthy ? 'ok' : 'degraded',
      checks
    }
  })
}
