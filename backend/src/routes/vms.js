/**
 * VM management routes
 * Create, start, stop, delete, list VMs
 */

import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { vmQueries, tenantQueries, sessionQueries } from '../models/db.js'
import { getOrkaClient } from '../services/orka.js'
import { generateConnectionCredentials } from '../services/ssh.js'

const createVMSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  vcpu: z.number().int().min(2).max(12).optional(),
  memory: z.number().int().min(4).max(32).optional(),
  baseImage: z.string().optional()
})

export async function vmRoutes(fastify, options) {
  // List all VMs for a tenant with pagination
  fastify.get('/', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess]
  }, async (request, reply) => {
    const { page = 1, limit = 50, status = null } = request.query

    // Build query with optional status filter
    let query = 'SELECT * FROM vm_instances WHERE tenant_id = $1'
    const params = [request.tenantId]
    let paramIndex = 2

    if (status) {
      query += ` AND status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, (page - 1) * limit)

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM vm_instances WHERE tenant_id = $1'
    const countParams = [request.tenantId]
    if (status) {
      countQuery += ' AND status = $2'
      countParams.push(status)
    }

    const [countResult, vmsResult] = await Promise.all([
      fastify.pg.query(countQuery, countParams),
      fastify.pg.query(query, params)
    ])

    const total = parseInt(countResult.rows[0].total)

    return {
      vms: vmsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  })

  // Create a new VM
  fastify.post('/', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess, fastify.requireCredits]
  }, async (request, reply) => {
    const body = createVMSchema.parse(request.body)

    // Check tenant's current VM count
    const existingResult = await fastify.pg.query(
      'SELECT COUNT(*) as count FROM vm_instances WHERE tenant_id = $1 AND status IN ($2, $3)',
      [request.tenantId, 'running', 'provisioning']
    )

    const vmCount = parseInt(existingResult.rows[0].count)

    // Tier limits
    const limits = {
      standard: 1,
      pro: 3,
      enterprise: 10
    }

    const limit = limits[request.tenant.tier] || limits.standard

    if (vmCount >= limit) {
      return reply.status(429).send({
        error: 'Too Many Requests',
        message: `VM limit reached for ${request.tenant.tier} tier (${limit} concurrent VMs)`
      })
    }

    // Generate unique VM name for Orka
    const vmId = uuidv4()
    const orkaVMName = `cc-${request.tenantId.slice(0, 8)}-${vmId.slice(0, 8)}`

    // Create VM record
    const vmResult = await fastify.pg.query(
      vmQueries.create,
      [
        request.tenantId,
        orkaVMName,
        body.vcpu || 4,
        body.memory || 14,
        body.baseImage || 'ventura-base'
      ]
    )

    const vm = vmResult.rows[0]

    // Provision in Orka asynchronously
    provisionOrkaVM(fastify, vm, body).catch(err => {
      fastify.log.error({ err, vmId: vm.id }, 'Failed to provision Orka VM')
    })

    return reply.status(201).send({
      vm: {
        id: vm.id,
        name: body.name || orkaVMName,
        status: vm.status,
        createdAt: vm.created_at
      },
      message: 'VM is being provisioned'
    })
  })

  // Get VM details
  fastify.get('/:vmId', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess]
  }, async (request, reply) => {
    const { vmId } = request.params

    const result = await fastify.pg.query(
      'SELECT * FROM vm_instances WHERE id = $1 AND tenant_id = $2',
      [vmId, request.tenantId]
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'VM not found'
      })
    }

    return {
      vm: result.rows[0]
    }
  })

  // Start VM
  fastify.post('/:vmId/start', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess, fastify.requireCredits]
  }, async (request, reply) => {
    const { vmId } = request.params

    const vmResult = await fastify.pg.query(
      'SELECT * FROM vm_instances WHERE id = $1 AND tenant_id = $2',
      [vmId, request.tenantId]
    )

    if (vmResult.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'VM not found'
      })
    }

    const vm = vmResult.rows[0]

    if (vm.status === 'running') {
      return { vm, message: 'VM is already running' }
    }

    // Start the VM in Orka
    const orka = getOrkaClient()
    const result = await orka.startVM(vm.orka_vm_name)

    if (!result.ok) {
      return reply.status(500).send({
        error: 'Failed to start VM',
        message: result.error
      })
    }

    // Update status
    await fastify.pg.query(
      'UPDATE vm_instances SET status = $2 WHERE id = $1',
      [vmId, 'running']
    )

    // Start billing session
    await fastify.pg.query(
      sessionQueries.start,
      [vmId]
    )

    return {
      vm: { ...vm, status: 'running' },
      message: 'VM started successfully'
    }
  })

  // Stop VM
  fastify.post('/:vmId/stop', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess]
  }, async (request, reply) => {
    const { vmId } = request.params

    const vmResult = await fastify.pg.query(
      'SELECT * FROM vm_instances WHERE id = $1 AND tenant_id = $2',
      [vmId, request.tenantId]
    )

    if (vmResult.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'VM not found'
      })
    }

    const vm = vmResult.rows[0]

    if (vm.status !== 'running') {
      return { vm, message: 'VM is not running' }
    }

    // Stop the VM in Orka
    const orka = getOrkaClient()
    const result = await orka.stopVM(vm.orka_vm_name)

    if (!result.ok) {
      return reply.status(500).send({
        error: 'Failed to stop VM',
        message: result.error
      })
    }

    // Update status
    await fastify.pg.query(
      'UPDATE vm_instances SET status = $2 WHERE id = $1',
      [vmId, 'stopped']
    )

    // End billing session
    const sessionResult = await fastify.pg.query(
      'SELECT id FROM vm_sessions WHERE vm_instance_id = $1 AND ended_at IS NULL',
      [vmId]
    )

    if (sessionResult.rows.length > 0) {
      // Calculate cost (at $5/hour = ~0.14 cents per minute)
      const session = sessionResult.rows[0]
      await fastify.pg.query(
        'UPDATE vm_sessions SET ended_at = NOW(), cost_cents = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER * 14 / 60 WHERE id = $1',
        [session.id]
      )
    }

    return {
      vm: { ...vm, status: 'stopped' },
      message: 'VM stopped successfully'
    }
  })

  // Delete VM
  fastify.delete('/:vmId', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess]
  }, async (request, reply) => {
    const { vmId } = request.params

    const vmResult = await fastify.pg.query(
      'SELECT * FROM vm_instances WHERE id = $1 AND tenant_id = $2',
      [vmId, request.tenantId]
    )

    if (vmResult.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'VM not found'
      })
    }

    const vm = vmResult.rows[0]

    // Stop if running
    if (vm.status === 'running') {
      const orka = getOrkaClient()
      await orka.stopVM(vm.orka_vm_name)
    }

    // Delete from Orka
    const orka = getOrkaClient()
    const result = await orka.deleteVM(vm.orka_vm_name)

    // Delete from database
    await fastify.pg.query(
      vmQueries.delete,
      [vmId, request.tenantId]
    )

    return {
      message: 'VM deleted successfully'
    }
  })

  // Get VM connection info
  fastify.get('/:vmId/connect', {
    onRequest: [fastify.authenticate, fastify.requireTenantAccess]
  }, async (request, reply) => {
    const { vmId } = request.params

    const result = await fastify.pg.query(
      'SELECT * FROM vm_instances WHERE id = $1 AND tenant_id = $2',
      [vmId, request.tenantId]
    )

    if (result.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'VM not found'
      })
    }

    const vm = result.rows[0]

    if (vm.status !== 'running') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'VM is not running'
      })
    }

    // Generate one-time credentials (valid for 5 minutes)
    const credentials = await generateConnectionCredentials(fastify.pg, vmId)

    // Return SSH connection details
    return {
      connection: {
        host: vm.ip_address,
        port: vm.ssh_port || 22,
        username: 'admin',
        password: credentials.password,
        expiresAt: credentials.expiresAt
      },
      warning: 'Credentials expire in 5 minutes. Use them immediately.'
    }
  })
}

/**
 * Async function to provision VM in Orka
 */
async function provisionOrkaVM(fastify, vm, options) {
  const orka = getOrkaClient()

  try {
    // Create VM in Orka
    const result = await orka.createVM({
      vmName: vm.orka_vm_name,
      vcpu: options.vcpu || 4,
      memory: options.memory || 14,
      orkaImage: options.baseImage || 'ventura-base'
    })

    if (!result.ok) {
      throw new Error(result.error || 'Failed to create VM')
    }

    // Update VM record with Orka VM ID
    await fastify.pg.query(
      'UPDATE vm_instances SET orka_vm_id = $1, status = $2 WHERE id = $3',
      [result.data?.vm_id || result.data?.id, 'ready', vm.id]
    )
  } catch (err) {
    // Mark as failed
    await fastify.pg.query(
      'UPDATE vm_instances SET status = $1, metadata = jsonb_set(metadata, $2, $3) WHERE id = $4',
      ['failed', '{error}', JSON.stringify(err.message), vm.id]
    )
  }
}
