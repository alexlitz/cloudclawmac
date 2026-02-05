/**
 * Admin routes for background jobs
 */

export async function jobRoutes(fastify, options) {
  // Get job status
  fastify.get('/status', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    return {
      jobs: {
        expiredVMCleanup: { schedule: '*/5 * * * *', description: 'Stop expired VMs' },
        vmStateSync: { schedule: '0 * * * *', description: 'Sync VM state with Orka' }
      }
    }
  })

  // Trigger manual cleanup (admin only)
  fastify.post('/cleanup', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { runCleanup } = await import('../services/background.js')
    const result = await runCleanup(fastify)

    return {
      message: 'Cleanup completed',
      result
    }
  })
}
