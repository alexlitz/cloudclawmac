import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute.jsx'
import { tenantApi, vmApi } from '../api.js'

function OnboardingContent() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [tenantId, setTenantId] = useState(null)
  const [vmConfig, setVmConfig] = useState({
    name: '',
    vcpu: 4,
    memory: 14
  })
  const [provisioning, setProvisioning] = useState(false)
  const [error, setError] = useState('')

  // Get existing tenant
  useEffect(() => {
    const tenants = JSON.parse(localStorage.getItem('tenants') || '[]')
    if (tenants.length > 0) {
      setTenantId(tenants[0].id)
    }
  }, [])

  async function handleCreateVM() {
    setLoading(true)
    setError('')

    try {
      // Create VM
      const data = await vmApi.create(tenantId, vmConfig)
      setProvisioning(true)

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const vmData = await vmApi.get(tenantId, data.vm.id)
          if (vmData.vm.status === 'ready' || vmData.vm.status === 'running') {
            clearInterval(pollInterval)
            setStep(4)
            setLoading(false)
          } else if (vmData.vm.status === 'failed') {
            clearInterval(pollInterval)
            setError('Failed to provision VM')
            setLoading(false)
          }
        } catch (err) {
          clearInterval(pollInterval)
          setError(err.message)
          setLoading(false)
        }
      }, 2000)

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        if (step === 3) {
          setLoading(false)
          setStep(4) // Continue anyway
        }
      }, 120000)

    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleSkip() {
    navigate('/dashboard')
  }

  async function handleFinish() {
    navigate('/dashboard')
  }

  return (
    <div className="container">
      {/* Onboarding header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 0',
        borderBottom: '1px solid var(--border)',
        marginBottom: '2rem'
      }}>
        <div className="logo">
          <span>☁</span> CloudClawMac
        </div>
        <button
          className="btn btn-ghost"
          onClick={handleSkip}
        >
          Skip
        </button>
      </div>

      {/* Progress steps */}
      <div className="onboarding-steps">
        <div className={`onboarding-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}></div>
        <div className={`onboarding-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}></div>
        <div className={`onboarding-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}></div>
      </div>

      {/* Step 1: Welcome */}
      {step === 1 && (
        <div className="onboarding">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👋</div>
          <h1>Welcome to CloudClawMac</h1>
          <p style={{ fontSize: '1.125rem', marginTop: '1rem' }}>
            Let's get you set up with your first isolated macOS VM.
            This will take about 2-3 minutes.
          </p>
          <button
            className="btn btn-primary btn-lg"
            style={{ marginTop: '2rem' }}
            onClick={() => setStep(2)}
          >
            Let's Get Started
          </button>
        </div>
      )}

      {/* Step 2: Configure VM */}
      {step === 2 && (
        <div className="onboarding" style={{ textAlign: 'left', maxWidth: '500px' }}>
          <h1>Configure Your VM</h1>
          <p style={{ marginBottom: '2rem' }}>
            Choose your VM configuration. You can change this later.
          </p>

          <div className="form-group">
            <label className="form-label">VM Name (optional)</label>
            <input
              type="text"
              className="form-input"
              value={vmConfig.name}
              onChange={(e) => setVmConfig({ ...vmConfig, name: e.target.value })}
              placeholder="My first VM"
            />
          </div>

          <div className="form-group">
            <label className="form-label">vCPUs</label>
            <select
              className="form-input"
              value={vmConfig.vcpu}
              onChange={(e) => setVmConfig({ ...vmConfig, vcpu: parseInt(e.target.value) })}
            >
              <option value="2">2 vCPUs</option>
              <option value="4">4 vCPUs (Recommended)</option>
              <option value="6">6 vCPUs</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Memory</label>
            <select
              className="form-input"
              value={vmConfig.memory}
              onChange={(e) => setVmConfig({ ...vmConfig, memory: parseInt(e.target.value) })}
            >
              <option value="8">8 GB</option>
              <option value="14">14 GB (Recommended)</option>
              <option value="28">28 GB</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Provisioning */}
      {step === 3 && (
        <div className="onboarding">
          {provisioning ? (
            <>
              <div className="loading" style={{ width: '48px', height: '48px', margin: '0 auto 2rem' }}></div>
              <h1>Provisioning Your VM...</h1>
              <p style={{ fontSize: '1.125rem', marginTop: '1rem' }}>
                This usually takes 2-3 minutes. We're setting up your isolated macOS environment.
              </p>
            </>
          ) : (
            <>
              <h1>Ready to Provision</h1>
              <p style={{ fontSize: '1.125rem', marginTop: '1rem' }}>
                We'll create your VM with these specifications:
              </p>
              <div style={{
                background: 'var(--bg-secondary)',
                padding: '1.5rem',
                borderRadius: 'var(--radius)',
                margin: '2rem auto',
                maxWidth: '300px',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>vCPUs</span>
                  <span>{vmConfig.vcpu}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Memory</span>
                  <span>{vmConfig.memory} GB</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Base Image</span>
                  <span>macOS Ventura</span>
                </div>
              </div>

              {error && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--error)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  color: 'var(--error)'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleCreateVM}
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create VM'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 4 && (
        <div className="onboarding">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h1>You're All Set!</h1>
          <p style={{ fontSize: '1.125rem', marginTop: '1rem' }}>
            Your VM is ready. You can now access it from your dashboard.
          </p>
          <button
            className="btn btn-primary btn-lg"
            style={{ marginTop: '2rem' }}
            onClick={handleFinish}
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  )
}

export function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingContent />
    </ProtectedRoute>
  )
}
