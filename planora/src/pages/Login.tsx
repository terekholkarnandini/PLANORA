import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthVisual from '../components/AuthVisual'
import AuthInput from '../components/AuthInput'
import '../styles/AuthOnboarding.css'
import { supabase } from '../lib/supabaseClient'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // --- Validations ---
    if (!email.trim() || !password) {
      setError('PLEASE FILL IN ALL REQUIRED FIELDS.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('PLEASE ENTER A VALID EMAIL ADDRESS.')
      return
    }

    if (password.length < 6) {
      setError('PASSWORD MUST BE AT LEAST 6 CHARACTERS.')
      return
    }

    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(signInError.message.toUpperCase())
        return
      }

      navigate('/welcome')
    } catch {
      setError('AN UNEXPECTED ERROR OCCURRED. PLEASE TRY AGAIN.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('PLEASE ENTER YOUR EMAIL ADDRESS FIRST.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    if (error) {
      setError(error.message.toUpperCase())
    } else {
      setError('PASSWORD RESET EMAIL SENT — CHECK YOUR INBOX.')
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) setError(error.message.toUpperCase())
    setLoading(false)
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

              <a href="#forgot" className="forgot-password-link" onClick={handleForgotPassword}>
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
