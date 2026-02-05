import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { RegisterPage } from './pages/RegisterPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { OnboardingPage } from './pages/OnboardingPage.jsx'
import { Header } from './components/Header.jsx'

function App() {
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')

  return (
    <div className="app">
      {!isDashboard && <Header />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/vms" element={<DashboardPage activeTab="vms" />} />
        <Route path="/dashboard/billing" element={<DashboardPage activeTab="billing" />} />
        <Route path="/dashboard/settings" element={<DashboardPage activeTab="settings" />} />
      </Routes>
    </div>
  )
}

export { App }
