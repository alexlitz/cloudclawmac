/**
 * SSH key management for VM connections
 * Generates one-time SSH credentials for secure VM access
 */

import crypto from 'crypto'

/**
 * Generate a random password
 */
export function generatePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const password = []
  const randomBytes = crypto.randomBytes(length)

  for (let i = 0; i < length; i++) {
    password.push(chars[randomBytes[i] % chars.length])
  }

  return password.join('')
}

/**
 * Generate SSH key pair
 */
export async function generateSSHKeyPair(comment = 'cloudclawmac') {
  // Simple implementation - in production, use a proper library like node-sshkey
  const keyId = crypto.randomBytes(8).toString('hex')
  const privateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
cloudclawmac-temp-${keyId}
${crypto.randomBytes(64).toString('base64')}
-----END OPENSSH PRIVATE KEY-----`

  const publicKey = `ssh-rsa ${crypto.randomBytes(32).toString('base64')} ${comment}`

  return { privateKey, publicKey, keyId }
}

/**
 * Store temporary credentials in database
 */
export async function storeTempCredentials(pgClient, vmId, credentials) {
  // Store with 5 minute expiry
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await pgClient.query(
    `UPDATE vm_instances
     SET metadata = jsonb_set(
       metadata,
       '{tempCredentials}',
       jsonb_build_object(
         'password', $1,
         'expiresAt', $2
       )
     )
     WHERE id = $3`,
    [credentials.password, expiresAt.toISOString(), vmId]
  )
}

/**
 * Get and clear temporary credentials
 */
export async function getTempCredentials(pgClient, vmId) {
  const result = await pgClient.query(
    `SELECT metadata->'tempCredentials' as creds
     FROM vm_instances
     WHERE id = $1`,
    [vmId]
  )

  if (!result.rows[0]?.creds) {
    return null
  }

  const creds = result.rows[0].creds

  // Check if expired
  if (new Date(creds.expiresAt) < new Date()) {
    await pgClient.query(
      `UPDATE vm_instances
       SET metadata = metadata - 'tempCredentials'
       WHERE id = $1`,
      [vmId]
    )
    return null
  }

  // Clear credentials after retrieval
  await pgClient.query(
    `UPDATE vm_instances
     SET metadata = metadata - 'tempCredentials'
     WHERE id = $1`,
    [vmId]
  )

  return creds
}

/**
 * Generate one-time connection credentials
 */
export async function generateConnectionCredentials(pgClient, vmId) {
  const password = generatePassword(20)

  // Store temporarily (5 min expiry)
  await storeTempCredentials(pgClient, vmId, { password })

  return { password, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
}
