/**
 * Environment validation
 * Ensures all required configuration is present and valid
 */

import { z } from 'zod'

/**
 * Schema for validating environment variables
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DATABASE_URL: z.string().url().optional(),

  // Security
  JWT_SECRET: z.string().min(16),

  // Orka
  ORKA_ENDPOINT: z.string().url(),
  ORKA_USERNAME: z.string().email().optional(),
  ORKA_PASSWORD: z.string().min(1).optional(),
  ORKA_TOKEN: z.string().min(1).optional(),
  ORKA_DEFAULT_VCPU: z.coerce.number().int().min(2).max(12).default(4),
  ORKA_DEFAULT_MEMORY: z.coerce.number().int().min(4).max(64).default(14),
  ORKA_BASE_IMAGE: z.string().default('ventura-base'),

  // Trial
  TRIAL_CREDITS: z.coerce.number().int().min(0).default(500),
  TRIAL_DURATION_DAYS: z.coerce.number().int().min(1).max(365).default(7),

  // Optional SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional()
}).refine(
  (data) => data.ORKA_USERNAME || data.ORKA_TOKEN,
  { message: "Either ORKA_USERNAME or ORKA_TOKEN must be provided" }
)

/**
 * Validation result type
 */
export class ValidationError extends Error {
  constructor(errors) {
    super('Environment validation failed')
    this.name = 'ValidationError'
    this.errors = errors
  }
}

/**
 * Validate environment variables
 */
export function validateEnv(env = process.env) {
  try {
    return envSchema.parse(env)
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errors = err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code
      }))
      throw new ValidationError(errors)
    }
    throw err
  }
}

/**
 * Check if setup is needed (missing critical config)
 */
export function needsSetup(env = process.env) {
  const needsSetup = [
    !env.JWT_SECRET || env.JWT_SECRET === 'change-this-in-production',
    !env.ORKA_USERNAME && !env.ORKA_TOKEN,
    !env.DATABASE_URL || env.DATABASE_URL.includes('localhost')
  ].some(Boolean)

  return needsSetup
}

/**
 * Get setup status for API response
 */
export function getSetupStatus(env = process.env) {
  return {
    setupRequired: needsSetup(env),
    checks: {
      jwtSecret: !!env.JWT_SECRET && env.JWT_SECRET !== 'change-this-in-production',
      orkaCredentials: !!(env.ORKA_USERNAME || env.ORKA_TOKEN),
      databaseConfigured: !!env.DATABASE_URL,
      smtpConfigured: !!(env.SMTP_HOST && env.SMTP_USER)
    }
  }
}

export { envSchema }
