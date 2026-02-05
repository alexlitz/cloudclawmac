import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header>
      <div className="container header-inner">
        <Link to="/" className="logo">
          <span>☁</span> CloudClawMac
        </Link>
        <nav className="nav">
          <Link to="/#features">Features</Link>
          <Link to="/#pricing">Pricing</Link>
          <Link to="/#how-it-works">How it Works</Link>
          <Link to="/login" className="btn btn-ghost">Log In</Link>
          <Link to="/register" className="btn btn-primary">Start Free Trial</Link>
        </nav>
      </div>
    </header>
  )
}
