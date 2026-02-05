/**
 * Database models and queries
 * Using PostgreSQL with proper multitenant isolation
 */

/**
 * Initialize database schema
 */
export const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tenants table (for multitenancy)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255),
  tier VARCHAR(50) DEFAULT 'standard',
  trial_credits INTEGER DEFAULT 500,
  trial_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- VM instances table
CREATE TABLE IF NOT EXISTS vm_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  orka_vm_name VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'provisioning',
  vcpu INTEGER DEFAULT 4,
  memory_gb INTEGER DEFAULT 14,
  base_image VARCHAR(255),
  ip_address INET,
  ssh_port INTEGER,
  orka_vm_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  stopped_at TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

-- VM sessions table (for tracking usage)
CREATE TABLE IF NOT EXISTS vm_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vm_instance_id UUID REFERENCES vm_instances(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  cost_cents INTEGER DEFAULT 0
);

-- Audit log for security
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vm_instances_tenant_id ON vm_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vm_instances_status ON vm_instances(status);
CREATE INDEX IF NOT EXISTS idx_vm_sessions_vm_id ON vm_sessions(vm_instance_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
`

/**
 * User queries
 */
export const userQueries = {
  create: `
    INSERT INTO users (email, password_hash, name)
    VALUES ($1, $2, $3)
    RETURNING id, email, name, created_at
  `,

  findByEmail: `
    SELECT * FROM users WHERE email = $1
  `,

  findById: `
    SELECT id, email, name, created_at, updated_at
    FROM users WHERE id = $1
  `,

  update: `
    UPDATE users
    SET name = COALESCE($2, name),
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, email, name, updated_at
  `,

  delete: `
    DELETE FROM users WHERE id = $1
    RETURNING id
  `
}

/**
 * Tenant queries
 */
export const tenantQueries = {
  create: `
    INSERT INTO tenants (user_id, name, tier, trial_credits, trial_ends_at)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
    RETURNing *
  `,

  findByUserId: `
    SELECT * FROM tenants WHERE user_id = $1
  `,

  findById: `
    SELECT * FROM tenants WHERE id = $1
  `,

  updateTier: `
    UPDATE tenants
    SET tier = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  deductCredits: `
    UPDATE tenants
    SET trial_credits = trial_credits - $2,
        updated_at = NOW()
    WHERE id = $1 AND trial_credits >= $2
    RETURNING *
  `,

  getUsageStats: `
    SELECT
      COUNT(*) as total_vms,
      COUNT(*) FILTER (WHERE status = 'running') as running_vms,
      COALESCE(SUM(duration_seconds), 0) as total_seconds,
      COALESCE(SUM(cost_cents), 0) as total_cost_cents
    FROM vm_instances
    LEFT JOIN vm_sessions ON vm_instances.id = vm_sessions.vm_instance_id
    WHERE vm_instances.tenant_id = $1
  `
}

/**
 * VM instance queries
 */
export const vmQueries = {
  create: `
    INSERT INTO vm_instances (tenant_id, orka_vm_name, status, vcpu, memory_gb, base_image, expires_at)
    VALUES ($1, $2, 'provisioning', $3, $4, $5, NOW() + INTERVAL '24 hours')
    RETURNING *
  `,

  findById: `
    SELECT * FROM vm_instances WHERE id = $1
  `,

  findByTenantId: `
    SELECT * FROM vm_instances
    WHERE tenant_id = $1
    ORDER BY created_at DESC
  `,

  findByOrkaName: `
    SELECT * FROM vm_instances WHERE orka_vm_name = $1
  `,

  updateStatus: `
    UPDATE vm_instances
    SET status = $2,
        ip_address = COALESCE($3, ip_address),
        ssh_port = COALESCE($4, ssh_port),
        orka_vm_id = COALESCE($5, orka_vm_id),
        started_at = CASE WHEN $2 = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
        stopped_at = CASE WHEN $2 = 'stopped' THEN NOW() ELSE stopped_at END
    WHERE id = $1
    RETURNING *
  `,

  extendExpiry: `
    UPDATE vm_instances
    SET expires_at = NOW() + INTERVAL '24 hours',
        metadata = jsonb_set(metadata, '{extensions}', COALESCE((metadata->>'extensions')::int, 0) + 1)
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `,

  delete: `
    DELETE FROM vm_instances WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `,

  findExpired: `
    SELECT * FROM vm_instances
    WHERE status = 'running' AND expires_at < NOW()
    FOR UPDATE
  `
}

/**
 * Session queries
 */
export const sessionQueries = {
  start: `
    INSERT INTO vm_sessions (vm_instance_id, started_at)
    VALUES ($1, NOW())
    RETURNING *
  `,

  end: `
    UPDATE vm_sessions
    SET ended_at = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
        cost_cents = $2
    WHERE id = $1
    RETURNING *
  `,

  findByVMId: `
    SELECT * FROM vm_sessions
    WHERE vm_instance_id = $1
    ORDER BY started_at DESC
  `,

  getActiveForVM: `
    SELECT * FROM vm_sessions
    WHERE vm_instance_id = $1 AND ended_at IS NULL
    LIMIT 1
  `
}

/**
 * Audit log queries
 */
export const auditQueries = {
  create: `
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `,

  findByTenantId: `
    SELECT * FROM audit_logs
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `
}
