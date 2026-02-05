/**
 * Authentication tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { build } from './helper.js'

describe('Authentication', () => {
  let app
  let testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'Test1234',
    name: 'Test User'
  }

  beforeAll(async () => {
    app = await build()
  })

  afterAll(async () => {
    await app.close()
  })

  it('should reject registration with weak password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `weak-${Date.now()}@example.com`,
        password: 'weak',
        name: 'Weak User'
      }
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toHaveProperty('error')
  })

  it('should register a new user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser
    })

    expect(response.statusCode).toBe(201)
    const data = response.json()
    expect(data).toHaveProperty('user')
    expect(data.user).toHaveProperty('id')
    expect(data.user.email).toBe(testUser.email)

    // Check for auth cookie
    expect(response.headers['set-cookie']).toBeDefined()
  })

  it('should reject duplicate registration', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser
    })

    expect(response.statusCode).toBe(409)
  })

  it('should reject login with invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: 'wrongpassword'
      }
    })

    expect(response.statusCode).toBe(401)
  })

  it('should login with valid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password
      }
    })

    expect(response.statusCode).toBe(200)
    const data = response.json()
    expect(data).toHaveProperty('user')
    expect(data).toHaveProperty('tenants')
    expect(Array.isArray(data.tenants)).toBe(true)

    // Check for auth cookie
    expect(response.headers['set-cookie']).toBeDefined()
  })

  it('should return current user with valid token', async () => {
    // First login to get token
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password
      }
    })

    const cookies = loginResponse.headers['set-cookie']
    const tokenCookie = cookies?.find(c => c.startsWith('token='))

    expect(tokenCookie).toBeDefined()

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: tokenCookie
      }
    })

    expect(response.statusCode).toBe(200)
    const data = response.json()
    expect(data).toHaveProperty('user')
    expect(data.user.email).toBe(testUser.email)
  })

  it('should reject request without authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me'
    })

    expect(response.statusCode).toBe(401)
  })

  it('should logout and clear cookies', async () => {
    // First login
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: testUser
    })

    const cookies = loginResponse.headers['set-cookie']
    const tokenCookie = cookies?.find(c => c.startsWith('token='))

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: tokenCookie
      }
    })

    expect(response.statusCode).toBe(200)

    // Verify cookie was cleared
    const clearCookie = response.headers['set-cookie']?.find(c => c.includes('token=;'))
    expect(clearCookie).toBeDefined()
  })
})
