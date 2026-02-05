import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import './SetupPage.css'
import '../index.css'

export function SetupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [setupComplete, setSetupComplete] = useState(false)

  // Form state
  const [adminData, setAdminData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  })
  const [orkaData, setOrkaData] = useState({
    endpoint: 'https://orka-api.macstadium.com',
    username: '',
    password: ''
  })
  const [smtpData, setSmtpData] = useState({
    host: '',
    port: '587',
    user: '',
    pass: '',
    from: ''
  })
  const [enableSmtp, setEnableSmtp] = useState(false)

  const [resultData, setResultData] = useState(null)

  useEffect(() => {
    // Check if setup is already complete
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(data => {
        if (data.setupComplete) {
          setSetupComplete(true)
        }
      })
      .catch(() => {})
  }, [])

  async function validateOrka() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/setup/validate-orka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orkaData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Orka validation failed')
      }

      setStep(3) // Move to admin setup
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function completeSetup() {
    if (adminData.password !== adminData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (adminData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      const payload = {
        adminEmail: adminData.email,
        adminPassword: adminData.password,
        adminName: adminData.name,
        ...orkaData,
        ...(enableSmtp ? {
          smtpHost: smtpData.host,
          smtpPort: parseInt(smtpData.port),
          smtpUser: smtpData.user,
          smtpPass: smtpData.pass,
          smtpFrom: smtpData.from
        } : {})
      }

      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Setup failed')
      }

      // Store token and navigate
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('tenants', JSON.stringify([data.tenant]))

      setResultData(data)
      setStep(5) // Success step
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function copyEnvTemplate() {
    navigator.clipboard.writeText(resultData.envTemplate)
    alert('Environment template copied to clipboard!')
  }

  function goToDashboard() {
    navigate('/dashboard')
  }

  if (setupComplete) {
    return (
      <div className="setup-page">
        <div className="setup-card">
          <div className="setup-icon">✓</div>
          <h1>Setup Already Complete</h1>
          <p>This application has already been configured.</p>
          <div className="setup-actions">
            <Link to="/login" className="btn btn-primary">Go to Login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-logo">
          <span>☁</span> CloudClawMac
        </div>

        {/* Progress indicator */}
        <div className="setup-progress">
          <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>1</div>
          <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>2</div>
          <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>3</div>
          <div className={`step ${step >= 4 ? 'active' : ''} ${step > 4 ? 'completed' : ''}`}>4</div>
        </div>

        {error && (
          <div className="setup-error">
            {error}
          </div>
        )}

        {/* Step 1: Welcome */}
        {step === 1 && (
          <>
            <h1>Welcome to CloudClawMac</h1>
            <p className="setup-description">
              Let's get your instance configured. This will only take a few minutes.
            </p>

            <div className="setup-info">
              <h3>You'll need:</h3>
              <ul>
                <li>✓ MacStadium Orka API credentials</li>
                <li>✓ Your admin email and password</li>
                <li>✓ (Optional) SMTP server for emails</li>
              </ul>
            </div>

            <div className="setup-actions">
              <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                Get Started
              </button>
            </div>
          </>
        )}

        {/* Step 2: Orka Configuration */}
        {step === 2 && (
          <>
            <h2>Configure MacStadium Orka</h2>
            <p className="setup-description">
              Enter your Orka API credentials. We'll test the connection before proceeding.
            </p>

            <div className="form-group">
              <label className="form-label">Orka API Endpoint</label>
              <input
                type="url"
                className="form-input"
                value={orkaData.endpoint}
                onChange={(e) => setOrkaData({ ...orkaData, endpoint: e.target.value })}
                placeholder="https://orka-api.macstadium.com"
              />
              <small className="form-hint">Your Orka cluster endpoint</small>
            </div>

            <div className="form-group">
              <label className="form-label">Orka Username (Email)</label>
              <input
                type="email"
                className="form-input"
                value={orkaData.username}
                onChange={(e) => setOrkaData({ ...orkaData, username: e.target.value })}
                placeholder="you@macstadium.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Orka Password</label>
              <input
                type="password"
                className="form-input"
                value={orkaData.password}
                onChange={(e) => setOrkaData({ ...orkaData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <div className="setup-actions">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={validateOrka}
                disabled={loading || !orkaData.endpoint || !orkaData.username || !orkaData.password}
              >
                {loading ? 'Testing Connection...' : 'Test & Continue'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Admin Account */}
        {step === 3 && (
          <>
            <h2>Create Admin Account</h2>
            <p className="setup-description">
              This will be your primary administrator account.
            </p>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={adminData.name}
                onChange={(e) => setAdminData({ ...adminData, name: e.target.value })}
                placeholder="Admin User"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={adminData.email}
                onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={adminData.password}
                onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                placeholder="At least 8 characters"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                value={adminData.confirmPassword}
                onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
              />
            </div>

            <div className="setup-actions">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(4)}
                disabled={!adminData.name || !adminData.email || !adminData.password}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Step 4: Optional SMTP */}
        {step === 4 && (
          <>
            <h2>Configure Email (Optional)</h2>
            <p className="setup-description">
              Add an SMTP server if you want to send emails (password resets, notifications, etc.)
            </p>

            <div className="form-group">
              <label className="form-toggle">
                <input
                  type="checkbox"
                  checked={enableSmtp}
                  onChange={(e) => setEnableSmtp(e.target.checked)}
                />
                <span>Enable email notifications</span>
              </label>
            </div>

            {enableSmtp && (
              <>
                <div className="form-group">
                  <label className="form-label">SMTP Host</label>
                  <input
                    type="text"
                    className="form-input"
                    value={smtpData.host}
                    onChange={(e) => setSmtpData({ ...smtpData, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SMTP Port</label>
                  <input
                    type="number"
                    className="form-input"
                    value={smtpData.port}
                    onChange={(e) => setSmtpData({ ...smtpData, port: e.target.value })}
                    placeholder="587"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SMTP Username</label>
                  <input
                    type="text"
                    className="form-input"
                    value={smtpData.user}
                    onChange={(e) => setSmtpData({ ...smtpData, user: e.target.value })}
                    placeholder="your-email@gmail.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SMTP Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={smtpData.pass}
                    onChange={(e) => setSmtpData({ ...smtpData, pass: e.target.value })}
                    placeholder="Your app password"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">From Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={smtpData.from}
                    onChange={(e) => setSmtpData({ ...smtpData, from: e.target.value })}
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
              </>
            )}

            <div className="setup-actions">
              <button className="btn btn-secondary" onClick={() => setStep(3)}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={completeSetup}
                disabled={loading || !adminData.email}
              >
                {loading ? 'Completing Setup...' : 'Complete Setup'}
              </button>
            </div>
          </>
        )}

        {/* Step 5: Success */}
        {step === 5 && resultData && (
          <>
            <div className="setup-icon success">✓</div>
            <h1>Setup Complete!</h1>
            <p className="setup-description">
              Your CloudClawMac instance is ready. Here's what to do next:
            </p>

            <div className="setup-steps">
              {resultData.nextSteps.map((step, i) => (
                <div key={i} className="setup-step-item">✓ {step}</div>
              ))}
            </div>

            <div className="setup-env-template">
              <h3>Environment Configuration</h3>
              <p className="setup-description">
                Save this to your <code>.env</code> file for persistent configuration:
              </p>
              <pre>{resultData.envTemplate}</pre>
              <button className="btn btn-secondary" onClick={copyEnvTemplate}>
                Copy to Clipboard
              </button>
            </div>

            <div className="setup-actions">
              <button className="btn btn-primary btn-lg" onClick={goToDashboard}>
                Go to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
