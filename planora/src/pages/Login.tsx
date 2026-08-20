import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthVisual from '../components/AuthVisual'
import AuthInput from '../components/AuthInput'
import '../styles/AuthOnboarding.css'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('PLEASE FILL IN ALL REQUIRED FIELDS.')
      return
    }

    setLoading(true)
    // Simulate API sign-in call
    setTimeout(() => {
      setLoading(false)
      // Save simulated session details
      localStorage.setItem('planora_user', JSON.stringify({ email, rememberMe }))
      // Redirect to onboarding
      navigate('/onboarding')
    }, 1000)
  }

  const handleGoogleLogin = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      localStorage.setItem('planora_user', JSON.stringify({ email: 'google.user@gmail.com', provider: 'google' }))
      navigate('/onboarding')
    }, 800)
  }

  return (
    <div className="auth-container">
      {/* LEFT HAND VISUAL */}
      <AuthVisual
        imageSrc="/exterior.png"
        labels={['PLANORA / AUTH', 'SPATIAL INTELLIGENCE', 'SYSTEM READY']}
        slogans={['YOUR IDEAS.', 'YOUR SPACE.', 'YOUR PLAN.']}
      />

      {/* RIGHT HAND FORM */}
      <main className="auth-form-container">
        <div className="auth-form-wrapper">
          <header className="auth-form-header">
            <h1>WELCOME BACK.</h1>
            <p>Continue designing and exploring your spaces with Planora.</p>
          </header>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}

            <AuthInput
              label="EMAIL ADDRESS"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ENTER YOUR EMAIL"
              required
            />

            <AuthInput
              label="PASSWORD"
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ENTER YOUR PASSWORD"
              required
            />

            <div className="form-options-row">
              <label className="custom-checkbox-container">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="checkmark" />
                REMEMBER ME
              </label>

              <a href="#forgot" className="forgot-password-link" onClick={(e) => { e.preventDefault(); alert('Simulated password reset email sent!'); }}>
                FORGOT PASSWORD?
              </a>
            </div>

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'AUTHENTICATING...' : 'SIGN IN'} <span className="arrow">→</span>
            </button>

            <div className="divider-row">
              <div className="divider-line" />
              <span className="divider-text">OR</span>
              <div className="divider-line" />
            </div>

            <button
              type="button"
              className="google-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              CONTINUE WITH GOOGLE
            </button>
          </form>

          <footer className="form-footer">
            Don't have an account?
            <Link to="/register">
              CREATE ACCOUNT <span className="arrow">→</span>
            </Link>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default Login
