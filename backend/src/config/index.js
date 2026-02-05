// Configuration loaded from environment with defaults

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/cloudclawmac',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',

  // Orka API
  orka: {
    endpoint: process.env.ORKA_ENDPOINT || 'https://orka-api.macstadium.com',
    username: process.env.ORKA_USERNAME || '',
    password: process.env.ORKA_PASSWORD || '',
    // For token-based auth (alternative to username/password)
    token: process.env.ORKA_TOKEN || '',
    // Default VM configuration
    defaults: {
      vcpu: parseInt(process.env.ORKA_DEFAULT_VCPU || '4'),
      memory: parseInt(process.env.ORKA_DEFAULT_MEMORY || '14'), // GB
      baseImage: process.env.ORKA_BASE_IMAGE || 'ventura-base',
    }
  },

  // Pricing tiers (in cents per hour)
  pricing: {
    standard: 500, // $5/hour
    pro: 1000,     // $10/hour
    enterprise: 2000 // $20/hour
  },

  // Free trial
  trial: {
    credits: parseInt(process.env.TRIAL_CREDITS || '500'), // $5 in cents
    durationDays: parseInt(process.env.TRIAL_DURATION_DAYS || '7')
  }
}
