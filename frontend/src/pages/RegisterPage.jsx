import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, APIError, AuthError } from '../api.js'

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    // Check password complexity
    const hasLetter = /[A-Za-z]/.test(password)
    const hasNumber = /\d/.test(password)
    if (!hasLetter || !hasNumber) {
      setError('Password must contain at least 1 letter and 1 number')
      return
    }

    setLoading(true)

    try {
      const data = await authApi.register(email, password, name)

      // Store user data (token is stored in httpOnly cookie)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('tenants', JSON.stringify([data.tenant]))

      // Navigate to onboarding
      navigate('/onboarding')
    } catch (err) {
      if (err instanceof AuthError || err instanceof APIError) {
        setError(err.message)
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const passwordValid = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
  const passwordsMatch = password === confirmPassword && password.length > 0

  return (
    <div className="container" style={{ maxWidth: '400px', paddingTop: '4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>Create Your Account</h1>
        <p>Start your free trial today</p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--error)',
            borderRadius: 'var(--radius)',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: 'var(--error)'
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Name
          </label>
          <input
            id="name"
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters with 1 letter and 1 number"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={loading}
            aria-invalid={password.length > 0 && !passwordValid ? 'true' : undefined}
          />
          {password.length > 0 && !passwordValid && (
            <small style={{ color: 'var(--error)', fontSize: '0.875rem' }}>
              Must be 8+ characters with 1 letter and 1 number
            </small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword" className="form-label">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="form-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            autoComplete="new-password"
            required
            disabled={loading}
            aria-invalid={confirmPassword.length > 0 && !passwordsMatch ? 'true' : undefined}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <small style={{ color: 'var(--error)', fontSize: '0.875rem' }}>
              Passwords do not match
            </small>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={loading || !passwordValid || !passwordsMatch}
          aria-busy={loading}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
          By signing up, you agree to our terms of service and privacy policy.
        </p>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  )
}
