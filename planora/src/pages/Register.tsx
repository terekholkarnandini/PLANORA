import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthVisual from '../components/AuthVisual'
import AuthInput from '../components/AuthInput'
import '../styles/AuthOnboarding.css'
import { supabase } from '../lib/supabaseClient'

const Register: React.FC = () => {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Password strength calculation
  const [strength, setStrength] = useState<'none' | 'weak' | 'medium' | 'strong'>('none')

  useEffect(() => {
    if (!password) {
      setStrength('none')
      return
    }

    let score = 0
    if (password.length >= 6) score++
    if (password.length >= 10) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 1) {
      setStrength('weak')
    } else if (score <= 3) {
      setStrength('medium')
    } else {
      setStrength('strong')
    }
  }, [password])

  const getStrengthBarClass = () => {
    switch (strength) {
      case 'weak': return 'strength-weak'
      case 'medium': return 'strength-medium'
      case 'strong': return 'strength-strong'
      default: return 'strength-none'
    }
  }

  const getStrengthText = () => {
    switch (strength) {
      case 'weak': return 'WEAK'
      case 'medium': return 'MEDIUM'
      case 'strong': return 'STRONG'
      default: return ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // --- Validations ---
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('PLEASE FILL IN ALL REQUIRED FIELDS.')
      return
    }

    if (fullName.trim().length < 2) {
      setError('FULL NAME MUST BE AT LEAST 2 CHARACTERS.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('PLEASE ENTER A VALID EMAIL ADDRESS.')
      return
    }

    if (password.length < 8) {
      setError('PASSWORD MUST BE AT LEAST 8 CHARACTERS.')
      return
    }

    if (password !== confirmPassword) {
      setError('PASSWORDS DO NOT MATCH.')
      return
    }

    if (!agreeTerms) {
      setError('YOU MUST AGREE TO THE TERMS AND PRIVACY POLICY.')
      return
    }

    setLoading(true)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      })

      if (signUpError) {
        setError(signUpError.message.toUpperCase())
        return
      }

      // Fire-and-forget welcome email — do not await so it never blocks navigation
      const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'
      fetch(`${backendUrl}/emails/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: fullName.trim() }),
      }).catch(() => {/* silently ignore email errors */})

      navigate('/onboarding')
    } catch {
      setError('AN UNEXPECTED ERROR OCCURRED. PLEASE TRY AGAIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      {/* LEFT HAND VISUAL */}
      <AuthVisual
        imageSrc="/interior.png"
        labels={['PLANORA / ACCESS', 'SPATIAL AI', 'CREATE / 001']}
        slogans={['START WITH AN IDEA.', 'BUILD A SPACE.']}
      />

      {/* RIGHT HAND FORM */}
      <main className="auth-form-container">
        <div className="auth-form-wrapper">
          <header className="auth-form-header">
            <h1>CREATE YOUR SPACE.</h1>
            <p>Start turning your architectural ideas into intelligent spaces.</p>
          </header>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}

            <AuthInput
              label="FULL NAME"
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ENTER YOUR FULL NAME"
              required
            />

            <AuthInput
              label="EMAIL ADDRESS"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ENTER YOUR EMAIL"
              required
            />

            <div className="input-group">
              <AuthInput
                label="PASSWORD"
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="CREATE A PASSWORD"
                required
              />

              {password && (
                <div className="password-strength-container">
                  <div className="password-strength-bar">
                    <div className={`password-strength-fill ${getStrengthBarClass()}`} />
                  </div>
                  <span className={`password-strength-label ${getStrengthBarClass()}`}>
                    STRENGTH: {getStrengthText()}
                  </span>
                </div>
              )}
            </div>

            <AuthInput
              label="CONFIRM PASSWORD"
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="CONFIRM YOUR PASSWORD"
              required
            />

            <div className="form-options-row">
              <label className="custom-checkbox-container">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <span className="checkmark" />
                I AGREE TO THE TERMS & PRIVACY POLICY
              </label>
            </div>

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'} <span className="arrow">→</span>
            </button>
          </form>

          <footer className="form-footer">
            Already have an account?
            <Link to="/login">
              SIGN IN <span className="arrow">→</span>
            </Link>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default Register
