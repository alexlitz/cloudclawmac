/**
 * Orka API Service
 * Handles communication with MacStadium Orka API for VM provisioning
 * Reference: https://documenter.getpostman.com/view/6578072/SVtVVNZk?version=latest
 */

import { config } from '../config/index.js'

const ORKA_API_VERSION = 'v2'

/**
 * Orka API Client class
 */
export class OrkaClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || config.orka.endpoint
    this.token = options.token || config.orka.token
    this.username = options.username || config.orka.username
    this.password = options.password || config.orka.password
    this.sessionToken = null
    this.sessionExpiry = null
  }

  /**
   * Get authentication headers
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    } else if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`
    }

    return headers
  }

  /**
   * Authenticate with Orka API (username/password flow)
   */
  async authenticate() {
    if (this.token) return true // Token auth, no session needed

    // Check if session is still valid
    if (this.sessionToken && this.sessionExpiry && Date.now() < this.sessionExpiry) {
      return true
    }

    const response = await this.request('POST', '/token', {
      email: this.username,
      password: this.password
    }, false) // Don't use auth for token request

    if (response.ok && response.data?.token) {
      this.sessionToken = response.data.token
      // Sessions typically expire after 30 minutes
      this.sessionExpiry = Date.now() + (25 * 60 * 1000)
      return true
    }

    throw new Error('Orka authentication failed')
  }

  /**
   * Make API request
   */
  async request(method, path, body = null, withAuth = true) {
    const url = `${this.endpoint}/api/${ORKA_API_VERSION}${path}`

    const options = {
      method,
      headers: withAuth ? this.getHeaders() : {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: data?.message || response.statusText
        }
      }

      return {
        ok: true,
        status: response.status,
        data
      }
    } catch (error) {
      return {
        ok: false,
        error: error.message
      }
    }
  }

  /**
   * Get health status of Orka cluster
   */
  async getHealth() {
    await this.authenticate()
    return this.request('GET', '/health')
  }

  /**
   * List all VMs
   */
  async listVMs() {
    await this.authenticate()
    return this.request('GET', '/vm')
  }

  /**
   * Get details of a specific VM
   */
  async getVM(vmName) {
    await this.authenticate()
    return this.request('GET', `/vm/${vmName}`)
  }

  /**
   * Create a new VM
   * @param {Object} options - VM configuration
   * @param {string} options.vmName - Unique VM name
   * @param {string} options.baseImage - Base image to use
   * @param {number} options.vcpu - Number of vCPUs
   * @param {number} options.vcpuCount - vCPU count per core
   * @param {number} options.memory - Memory in GB
   * @param {string} options.orkaImage - Image name in Orka
   */
  async createVM(options) {
    await this.authenticate()

    const payload = {
      vm_name: options.vmName,
      orka_image_name: options.orkaImage || config.orka.defaults.baseImage,
      vcpu: options.vcpu || config.orka.defaults.vcpu,
      vcpu_count: options.vcpuCount || 1,
      memory: options.memory || config.orka.defaults.memory
    }

    return this.request('POST', '/vm/create', payload)
  }

  /**
   * Start a VM
   */
  async startVM(vmName) {
    await this.authenticate()
    return this.request('POST', `/vm/${vmName}/start`)
  }

  /**
   * Stop a VM
   */
  async stopVM(vmName) {
    await this.authenticate()
    return this.request('POST', `/vm/${vmName}/stop`)
  }

  /**
   * Delete a VM
   */
  async deleteVM(vmName) {
    await this.authenticate()
    return this.request('DELETE', `/vm/${vmName}`)
  }

  /**
   * Get VM status
   */
  async getVMStatus(vmName) {
    await this.authenticate()
    return this.request('GET', `/vm/${vmName}/status`)
  }

  /**
   * Exec command in VM (via SSH)
   * Note: This requires SSH credentials to be configured
   */
  async execInVM(vmName, command) {
    // This would typically be done via SSH connection
    // For now, return a placeholder
    return {
      ok: false,
      error: 'SSH execution not implemented'
    }
  }

  /**
   * List available images/templates
   */
  async listImages() {
    await this.authenticate()
    return this.request('GET', '/image')
  }

  /**
   * Get node status
   */
  async getNodeStatus() {
    await this.authenticate()
    return this.request('GET', '/node')
  }
}

/**
 * Factory function to create an Orka client instance
 */
export function createOrkaClient(options) {
  return new OrkaClient(options)
}

/**
 * Singleton instance for default usage
 */
let defaultClient = null

export function getOrkaClient() {
  if (!defaultClient) {
    defaultClient = new OrkaClient()
  }
  return defaultClient
}
