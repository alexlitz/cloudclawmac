/**
 * VM management tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { build } from './helper.js'

describe('VM Management', () => {
  let app
  let testUser
  let testTenant
  let authToken

  beforeAll(async () => {
    app = await build()

    // Create test user and tenant
    testUser = {
      email: `vmtest-${Date.now()}@example.com`,
      password: 'Test1234',
      name: 'VM Test User'
    }

    // Register user
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser
    })

    const data = registerResponse.json()
    testTenant = data.tenant

    // Get token from cookie
    const cookies = registerResponse.headers['set-cookie']
    const tokenCookie = cookies?.find(c => c.startsWith('token='))
    authToken = tokenCookie?.match(/token=([^;]+)/)?.[1]
  })

  afterAll(async () => {
    // Cleanup test data
    if (app && testUser) {
      await app.pg.query('DELETE FROM users WHERE email = $1', [testUser.email])
    }
    await app.close()
  })

  it('should list VMs (empty initially)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/tenants/${testTenant.id}/vms`,
      headers: {
        cookie: `token=${authToken}`
      }
    })

    expect(response.statusCode).toBe(200)
    const data = response.json()
    expect(data).toHaveProperty('vms')
    expect(Array.isArray(data.vms)).toBe(true)
    expect(data.vms.length).toBe(0)
  })

  it('should require authentication to list VMs', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/tenants/${testTenant.id}/vms`
    })

    expect(response.statusCode).toBe(401)
  })

  it('should reject VM creation without credits', async () => {
    // First, set credits to 0
    await app.pg.query(
      'UPDATE tenants SET trial_credits = 0 WHERE id = $1',
      [testTenant.id]
    )

    const response = await app.inject({
      method: 'POST',
      url: `/api/tenants/${testTenant.id}/vms`,
      headers: {
        cookie: `token=${authToken}`
      },
      payload: {
        name: 'Test VM',
        vcpu: 4,
        memory: 14
      }
    })

    expect(response.statusCode).toBe(402)
  })

  it('should validate VM configuration', async () => {
    // Restore credits
    await app.pg.query(
      'UPDATE tenants SET trial_credits = 500 WHERE id = $1',
      [testTenant.id]
    )

    const response = await app.inject({
      method: 'POST',
      url: `/api/tenants/${testTenant.id}/vms`,
      headers: {
        cookie: `token=${authToken}`
      },
      payload: {
        vcpu: 20, // Invalid - exceeds max
        memory: 14
      }
    })

    // Should get validation error
    expect([400, 422, 429]).toContain(response.statusCode)
  })

  it('should get tenant usage stats', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/tenants/${testTenant.id}`,
      headers: {
        cookie: `token=${authToken}`
      }
    })

    expect(response.statusCode).toBe(200)
    const data = response.json()
    expect(data).toHaveProperty('tenant')
    expect(data.tenant).toHaveProperty('usage')
  })
})
