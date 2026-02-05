/**
 * Background job scheduler
 * Handles periodic tasks like VM cleanup, billing, etc.
 */

import cron from 'node-cron'
import { getOrkaClient } from './orka.js'
import { vmQueries } from '../models/db.js'

/**
 * Stop expired VMs and calculate final costs
 */
async function stopExpiredVMs(pgClient) {
  try {
    // Find all expired running VMs
    const result = await pgClient.query(vmQueries.findExpired)

    if (result.rows.length === 0) {
      return { stopped: 0 }
    }

    const orka = getOrkaClient()
    let stoppedCount = 0

    for (const vm of result.rows) {
      try {
        // Stop the VM in Orka
        await orka.stopVM(vm.orka_vm_name)

        // Update status in database
        await pgClient.query(
          'UPDATE vm_instances SET status = $1, stopped_at = NOW() WHERE id = $2',
          ['expired', vm.id]
        )

        // End the billing session
        const sessionResult = await pgClient.query(
          'SELECT id FROM vm_sessions WHERE vm_instance_id = $1 AND ended_at IS NULL',
          [vm.id]
        )

        if (sessionResult.rows.length > 0) {
          // Calculate cost based on elapsed time (at $5/hour = ~0.14 cents per minute)
          const sessionId = sessionResult.rows[0].id
          await pgClient.query(
            `UPDATE vm_sessions
             SET ended_at = NOW(),
                 duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
                 cost_cents = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER * 14 / 60
             WHERE id = $1`,
            [sessionId]
          )
        }

        stoppedCount++
      } catch (err) {
        console.error(`Failed to stop expired VM ${vm.id}:`, err.message)
      }
    }

    return { stopped: stoppedCount }
  } catch (err) {
    console.error('Error in stopExpiredVMs:', err)
    return { stopped: 0, error: err.message }
  }
}

/**
 * Check for orphaned VMs (in DB but not in Orka)
 */
async function syncVMState(pgClient) {
  try {
    const result = await pgClient.query(
      'SELECT id, orka_vm_name, status FROM vm_instances WHERE status IN ($1, $2)',
      ['running', 'starting']
    )

    const orka = getOrkaClient()
    let updatedCount = 0

    for (const vm of result.rows) {
      try {
        const orkaVM = await orka.getVMStatus(vm.orka_vm_name)

        if (!orkaVM.ok || orkaVM.data?.status !== 'running') {
          // VM not actually running in Orka, update DB
          await pgClient.query(
            'UPDATE vm_instances SET status = $1 WHERE id = $2',
            ['stopped', vm.id]
          )
          updatedCount++
        }
      } catch (err) {
        // Can't reach Orka or VM doesn't exist
        await pgClient.query(
          'UPDATE vm_instances SET status = $1 WHERE id = $2',
          ['unknown', vm.id]
        )
        updatedCount++
      }
    }

    return { synced: updatedCount }
  } catch (err) {
    console.error('Error in syncVMState:', err)
    return { synced: 0, error: err.message }
  }
}

/**
 * Initialize background jobs
 */
export function initBackgroundJobs(fastify) {
  // Run every 5 minutes to check for expired VMs
  cron.schedule('*/5 * * * *', async () => {
    fastify.log.info('Running expired VM cleanup...')

    const result = await stopExpiredVMs(fastify.pg)

    if (result.stopped > 0) {
      fastify.log.info({ stopped: result.stopped }, 'Stopped expired VMs')
    }
  })

  // Run every hour to sync VM state with Orka
  cron.schedule('0 * * * *', async () => {
    fastify.log.info('Syncing VM state with Orka...')

    const result = await syncVMState(fastify.pg)

    if (result.synced > 0) {
      fastify.log.info({ synced: result.synced }, 'VMs synced')
    }
  })

  fastify.log.info('Background jobs initialized')
}

/**
 * Manually trigger cleanup (for testing)
 */
export async function runCleanup(fastify) {
  return await stopExpiredVMs(fastify.pg)
}

export { stopExpiredVMs, syncVMState }
