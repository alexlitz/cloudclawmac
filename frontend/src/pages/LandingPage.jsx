import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <p className="text-accent" style={{ color: 'var(--accent)', fontWeight: 500, marginBottom: '1rem' }}>
            Don't install powerful AI agents locally.
          </p>
          <h1>Run AI Agents Safely in the Cloud</h1>
          <p className="hero-subtitle">
            Powerful AI agents can access files, browsers, and tools. That's exactly why
            you shouldn't run them on your computer. CloudClawMac runs them in isolated macOS VMs.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary btn-lg">Start Free Trial</Link>
            <a href="#how-it-works" className="btn btn-secondary btn-lg">See How It Works</a>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Free trial • No credit card required • $5 in credits
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2>All the power, none of the risk</h2>
            <p style={{ marginTop: '1rem' }}>Get the capabilities of powerful AI agents without touching your computer.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <h3>Keeps Your Computer Clean</h3>
              <p>Nothing runs on your local machine. AI agents execute in isolated environments.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Instant Access</h3>
              <p>Your isolated macOS instance is ready in minutes. No waiting for hardware.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🚀</div>
              <h3>Minimal Setup</h3>
              <p>No terminal, no commands, no Docker, no VPS. Just sign up and go.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Automatic Updates</h3>
              <p>Always running the latest versions. We handle the maintenance.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💾</div>
              <h3>Backups & Snapshots</h3>
              <p>Recover your instance quickly if something breaks. State is preserved.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Support Included</h3>
              <p>If you hit an issue, we help you get unstuck. You're not alone.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2>Get Started in Three Simple Steps</h2>
            <p style={{ marginTop: '1rem' }}>From zero to running AI agent in minutes.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                fontSize: '1.5rem',
                fontWeight: 'bold'
              }}>1</div>
              <h3>Sign Up and Start Your Free Trial</h3>
              <p>Create an account in seconds. No credit card required.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                fontSize: '1.5rem',
                fontWeight: 'bold'
              }}>2</div>
              <h3>Get Your Private Instance in Minutes</h3>
              <p>We spin up a dedicated macOS VM just for you. Free for the first minutes.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                fontSize: '1.5rem',
                fontWeight: 'bold'
              }}>3</div>
              <h3>Run Your AI Agent Safely</h3>
              <p>Experience the power of AI agents without risking your local machine.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2>Predictable Pricing</h2>
            <p style={{ marginTop: '1rem' }}>One monthly price. No surprise infrastructure bills.</p>
          </div>
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="pricing-tier">Standard</div>
              <div className="pricing-price">$29<span>/month</span></div>
              <ul className="pricing-features">
                <li>1 concurrent VM</li>
                <li>4 vCPUs</li>
                <li>14GB RAM</li>
                <li>Community support</li>
              </ul>
              <Link to="/register" className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>Get Started</Link>
            </div>
            <div className="pricing-card featured">
              <div className="pricing-tier">Pro</div>
              <div className="pricing-price">$49<span>/month</span></div>
              <ul className="pricing-features">
                <li>3 concurrent VMs</li>
                <li>6 vCPUs</li>
                <li>28GB RAM</li>
                <li>Priority support</li>
                <li>VM Snapshots</li>
              </ul>
              <Link to="/register" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>Get Started</Link>
            </div>
            <div className="pricing-card">
              <div className="pricing-tier">Enterprise</div>
              <div className="pricing-price">$99<span>/month</span></div>
              <ul className="pricing-features">
                <li>10 concurrent VMs</li>
                <li>12 vCPUs</li>
                <li>56GB RAM</li>
                <li>Dedicated support</li>
                <li>Custom images</li>
                <li>Full API access</li>
              </ul>
              <Link to="/register" className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>Contact Us</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ textAlign: 'center', padding: '6rem 0' }}>
        <div className="container">
          <h2 style={{ marginBottom: '1.5rem' }}>Try It Free, Then Decide</h2>
          <p style={{ marginBottom: '2rem', fontSize: '1.125rem' }}>
            Start with a free trial. No credit card required.
          </p>
          <Link to="/register" className="btn btn-primary btn-lg">Start Your Free Trial</Link>
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
            Questions? Email us at <a href="mailto:hello@cloudclawmac.com">hello@cloudclawmac.com</a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="container">
          <p>&copy; 2025 CloudClawMac. All rights reserved.</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Runs on MacStadium infrastructure • Built on Orka virtualization
          </p>
        </div>
      </footer>
    </div>
  )
}
