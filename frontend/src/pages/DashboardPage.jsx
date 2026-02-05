import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute.jsx'
import { tenantApi, vmApi } from '../api.js'

function DashboardContent({ activeTab = 'overview' }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState(activeTab)
  const [user, setUser] = useState(null)
  const [tenants, setTenants] = useState([])
  const [currentTenant, setCurrentTenant] = useState(null)
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [showNewVM, setShowNewVM] = useState(false)

  useEffect(() => {
    // Check auth
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    // Load user data
    const userData = JSON.parse(localStorage.getItem('user') || 'null')
    const tenantsData = JSON.parse(localStorage.getItem('tenants') || '[]')

    setUser(userData)
    setTenants(tenantsData)
    if (tenantsData.length > 0) {
      setCurrentTenant(tenantsData[0])
      loadVMs(tenantsData[0].id)
    }
  }, [navigate])

  async function loadVMs(tenantId) {
    setLoading(true)
    try {
      const data = await vmApi.list(tenantId)
      setVms(data.vms || [])
    } catch (err) {
      console.error('Failed to load VMs:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleStartVM(vmId) {
    setActionLoading(vmId)
    try {
      await vmApi.start(currentTenant.id, vmId)
      await loadVMs(currentTenant.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleStopVM(vmId) {
    setActionLoading(vmId)
    try {
      await vmApi.stop(currentTenant.id, vmId)
      await loadVMs(currentTenant.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteVM(vmId) {
    if (!confirm('Are you sure you want to delete this VM?')) return

    setActionLoading(vmId)
    try {
      await vmApi.delete(currentTenant.id, vmId)
      await loadVMs(currentTenant.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreateVM(e) {
    e.preventDefault()
    setActionLoading('new')
    try {
      const formData = new FormData(e.target)
      await vmApi.create(currentTenant.id, {
        name: formData.get('name'),
        vcpu: parseInt(formData.get('vcpu')),
        memory: parseInt(formData.get('memory'))
      })
      setShowNewVM(false)
      await loadVMs(currentTenant.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  function handleLogout() {
    localStorage.clear()
    navigate('/login')
  }

  if (!user || !currentTenant) {
    return <div className="dashboard-content">Loading...</div>
  }

  const runningCount = vms.filter(vm => vm.status === 'running').length

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo" style={{ marginBottom: '2rem' }}>
          <span>☁</span> CloudClawMac
        </div>

        <nav className="sidebar-nav">
          <a
            href="#"
            className={tab === 'overview' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setTab('overview') }}
          >
            <span>📊</span> Overview
          </a>
          <a
            href="#"
            className={tab === 'vms' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setTab('vms') }}
          >
            <span>🖥️</span> VMs
          </a>
          <a
            href="#"
            className={tab === 'billing' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setTab('billing') }}
          >
            <span>💳</span> Billing
          </a>
          <a
            href="#"
            className={tab === 'settings' ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); setTab('settings') }}
          >
            <span>⚙️</span> Settings
          </a>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Signed in as
          </div>
          <div style={{ fontWeight: 500, marginBottom: '1rem' }}>{user.email}</div>
          <button className="btn btn-ghost" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <div>
            <h1>{tab === 'vms' ? 'My VMs' : tab === 'billing' ? 'Billing' : tab === 'settings' ? 'Settings' : 'Dashboard'}</h1>
            <p>Tenant: {currentTenant.name}</p>
          </div>
          {tab === 'vms' && (
            <button
              className="btn btn-primary"
              onClick={() => setShowNewVM(true)}
            >
              + New VM
            </button>
          )}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Running VMs</div>
                <div className="stat-value">{runningCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Trial Credits</div>
                <div className="stat-value">${(currentTenant.trialCredits || 0) / 100}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Tier</div>
                <div className="stat-value" style={{ textTransform: 'capitalize' }}>
                  {currentTenant.tier}
                </div>
              </div>
            </div>

            <h2 style={{ marginBottom: '1rem' }}>Recent VMs</h2>
            {vms.length === 0 ? (
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '3rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🖥️</div>
                <h3>No VMs yet</h3>
                <p style={{ marginBottom: '1.5rem' }}>Create your first VM to get started.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => { setTab('vms'); setShowNewVM(true) }}
                >
                  Create Your First VM
                </button>
              </div>
            ) : (
              <div>
                {vms.slice(0, 3).map(vm => (
                  <div key={vm.id} className="vm-card">
                    <div className="vm-header">
                      <span className="vm-name">{vm.orka_vm_name}</span>
                      <span className={`vm-status ${vm.status}`}>{vm.status}</span>
                    </div>
                  </div>
                ))}
                {vms.length > 3 && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => setTab('vms')}
                  >
                    View All VMs →
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* VMs Tab */}
        {tab === 'vms' && (
          <>
            {showNewVM && (
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem',
                marginBottom: '2rem'
              }}>
                <h3 style={{ marginBottom: '1rem' }}>Create New VM</h3>
                <form onSubmit={handleCreateVM}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input name="name" className="form-input" placeholder="My VM" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">vCPUs</label>
                      <select name="vcpu" className="form-input">
                        <option value="2">2</option>
                        <option value="4" selected>4</option>
                        <option value="6">6</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Memory (GB)</label>
                      <select name="memory" className="form-input">
                        <option value="8">8</option>
                        <option value="14" selected>14</option>
                        <option value="28">28</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={actionLoading === 'new'}>
                      {actionLoading === 'new' ? 'Creating...' : 'Create VM'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowNewVM(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="loading" style={{ width: '40px', height: '40px', margin: '0 auto' }}></div>
              </div>
            ) : vms.length === 0 ? (
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '3rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🖥️</div>
                <h3>No VMs yet</h3>
                <p style={{ marginBottom: '1.5rem' }}>Create your first VM to get started.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowNewVM(true)}
                >
                  Create Your First VM
                </button>
              </div>
            ) : (
              vms.map(vm => (
                <div key={vm.id} className="vm-card">
                  <div className="vm-header">
                    <div>
                      <div className="vm-name">{vm.orka_vm_name}</div>
                      <div className="vm-info">
                        <span>{vm.vcpu} vCPUs</span>
                        <span>{vm.memory_gb} GB RAM</span>
                        <span>{new Date(vm.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className={`vm-status ${vm.status}`}>{vm.status}</span>
                  </div>
                  <div className="vm-actions">
                    {vm.status === 'running' ? (
                      <>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {/* TODO: Connect */ }}
                        >
                          Connect
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleStopVM(vm.id)}
                          disabled={actionLoading === vm.id}
                        >
                          {actionLoading === vm.id ? 'Stopping...' : 'Stop'}
                        </button>
                      </>
                    ) : vm.status === 'ready' || vm.status === 'stopped' ? (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleStartVM(vm.id)}
                          disabled={actionLoading === vm.id}
                        >
                          {actionLoading === vm.id ? 'Starting...' : 'Start'}
                        </button>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {vm.status === 'provisioning' ? 'Provisioning...' : vm.status}
                      </span>
                    )}
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleDeleteVM(vm.id)}
                      disabled={actionLoading === vm.id}
                      style={{ color: 'var(--error)', marginLeft: 'auto' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Billing Tab */}
        {tab === 'billing' && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Trial Credits</div>
                <div className="stat-value">${(currentTenant.trialCredits || 0) / 100}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Current Tier</div>
                <div className="stat-value" style={{ textTransform: 'capitalize' }}>
                  {currentTenant.tier}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Trial Ends</div>
                <div className="stat-value">
                  {currentTenant.trial_ends_at
                    ? new Date(currentTenant.trial_ends_at).toLocaleDateString()
                    : 'N/A'}
                </div>
              </div>
            </div>

            <h2 style={{ marginBottom: '1rem' }}>Upgrade Your Plan</h2>
            <div className="pricing-grid">
              <div className={`pricing-card ${currentTenant.tier === 'standard' ? 'featured' : ''}`}>
                <div className="pricing-tier">Standard</div>
                <div className="pricing-price">$29<span>/month</span></div>
                <ul className="pricing-features">
                  <li>1 concurrent VM</li>
                  <li>4 vCPUs</li>
                  <li>14GB RAM</li>
                </ul>
              </div>
              <div className={`pricing-card ${currentTenant.tier === 'pro' ? 'featured' : ''}`}>
                <div className="pricing-tier">Pro</div>
                <div className="pricing-price">$49<span>/month</span></div>
                <ul className="pricing-features">
                  <li>3 concurrent VMs</li>
                  <li>6 vCPUs</li>
                  <li>28GB RAM</li>
                  <li>Snapshots</li>
                </ul>
              </div>
              <div className={`pricing-card ${currentTenant.tier === 'enterprise' ? 'featured' : ''}`}>
                <div className="pricing-tier">Enterprise</div>
                <div className="pricing-price">$99<span>/month</span></div>
                <ul className="pricing-features">
                  <li>10 concurrent VMs</li>
                  <li>12 vCPUs</li>
                  <li>56GB RAM</li>
                  <li>Full API access</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div style={{ maxWidth: '600px' }}>
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ marginBottom: '1rem' }}>Account</h3>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={user.name || ''}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={user.email || ''}
                  readOnly
                />
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem'
            }}>
              <h3 style={{ marginBottom: '1rem' }}>Tenant</h3>
              <div className="form-group">
                <label className="form-label">Tenant Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={currentTenant.name || ''}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tenant ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={currentTenant.id || ''}
                  readOnly
                  style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function DashboardPage({ activeTab = 'overview' }) {
  return (
    <ProtectedRoute>
      <DashboardContent activeTab={activeTab} />
    </ProtectedRoute>
  )
}
