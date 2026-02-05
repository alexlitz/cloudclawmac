/**
 * Database models and queries
 * Using PostgreSQL with Row-Level Security for proper multitenant isolation
 */

/**
 * Initialize database schema with Row-Level Security
 */
export const schema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- ============================================
-- ROW-LEVEL SECURITY (RLS) FOR MULTITENANCY
-- ============================================

-- Enable RLS on tenant-sensitive tables
ALTER TABLE vm_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE vm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- VM Instances: Users can only see VMs belonging to their tenants
CREATE POLICY vm_instances_tenant_isolation ON vm_instances
  FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE user_id = current_setting('app.user_id')::UUID
    )
  );

-- VM Sessions: Same isolation via VM
CREATE POLICY vm_sessions_tenant_isolation ON vm_sessions
  FOR ALL
  USING (
    vm_instance_id IN (
      SELECT id FROM vm_instances WHERE tenant_id IN (
        SELECT id FROM tenants WHERE user_id = current_setting('app.user_id')::UUID
      )
    )
  );

-- Audit Logs: Users can only see their own tenant's logs
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE user_id = current_setting('app.user_id')::UUID
    )
  );

-- Tenants: Users can only see their own tenants
CREATE POLICY tenants_user_isolation ON tenants
  FOR ALL
  USING (user_id = current_setting('app.user_id')::UUID);

-- Admin role (bypasses RLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cloudclawmac_admin') THEN
    CREATE ROLE cloudclawmac_admin WITH NOLOGIN;
  END IF;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO cloudclawmac_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cloudclawmac_admin;

-- Application role (with RLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cloudclawmac_app') THEN
    CREATE ROLE cloudclawmac_app WITH NOLOGIN;
  END IF;
END $$;

GRANT CONNECT ON DATABASE cloudclawmac TO cloudclawmac_app;
GRANT USAGE ON SCHEMA public TO cloudclawmac_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cloudclawmac_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cloudclawmac_app;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vm_instances_tenant_id ON vm_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vm_instances_status ON vm_instances(status);
CREATE INDEX IF NOT EXISTS idx_vm_sessions_vm_id ON vm_sessions(vm_instance_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`

/**
 * Helper to set user context for RLS
 */
export function setUserContext(pgClient, userId) {
  return pgClient.query('SET LOCAL app.user_id = $1', [userId])
}

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
 * Tenant queries (with RLS context)
 */
export const tenantQueries = {
  create: `
    INSERT INTO tenants (user_id, name, tier, trial_credits, trial_ends_at)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
    RETURNING *
  `,

  // Fixed: Use parameterized query instead of string interpolation
  findByUserId: `
    SELECT * FROM tenants WHERE user_id = $1
  `,

  findByUserIdWithRLS: `
    SELECT * FROM find_user_tenants($1)
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
 * VM instance queries (with RLS)
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

/**
 * Function to bypass RLS for admin operations
 */
export const adminFunctions = `
-- Function to find all user tenants (bypasses RLS when called by admin)
CREATE OR REPLACE FUNCTION find_user_tenants(user_id UUID)
RETURNS SETOF tenants
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM tenants WHERE tenants.user_id = $1;
END;
$$;

-- Function to create VM (bypasses RLS)
CREATE OR REPLACE FUNCTION create_vm_for_tenant(
  p_tenant_id UUID,
  p_orka_name VARCHAR,
  p_vcpu INTEGER,
  p_memory INTEGER,
  p_base_image VARCHAR
)
RETURNS vm_instances
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result vm_instances;
BEGIN
  INSERT INTO vm_instances (tenant_id, orka_vm_name, vcpu, memory_gb, base_image, expires_at)
  VALUES (p_tenant_id, p_orka_name, p_vcpu, p_memory, p_base_image, NOW() + INTERVAL '24 hours')
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Function to update VM status (bypasses RLS)
CREATE OR REPLACE FUNCTION update_vm_status(
  p_vm_id UUID,
  p_status VARCHAR,
  p_ip INET,
  p_ssh_port INTEGER,
  p_orka_id VARCHAR
)
RETURNS vm_instances
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result vm_instances;
BEGIN
  UPDATE vm_instances
  SET status = p_status,
      ip_address = COALESCE(p_ip, ip_address),
      ssh_port = COALESCE(p_ssh_port, ssh_port),
      orka_vm_id = COALESCE(p_orka_id, orka_vm_id),
      started_at = CASE WHEN p_status = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
      stopped_at = CASE WHEN p_status = 'stopped' THEN NOW() ELSE stopped_at END
  WHERE id = p_vm_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;
`
