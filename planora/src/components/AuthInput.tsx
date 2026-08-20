import React, { useState } from 'react'

interface AuthInputProps {
  label: string
  type: string
  id: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
  error?: string
}

const AuthInput: React.FC<AuthInputProps> = ({
  label,
  type,
  id,
  value,
  onChange,
  placeholder,
  required = false,
  error,
}) => {
  const [showPassword, setShowPassword] = useState(false)

  const isPassword = type === 'password'
  const currentType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className="input-group">
      <div className="input-label-row">
        <label htmlFor={id} className="input-label">
          {label}
        </label>
        {error && <span className="auth-error-msg" style={{ color: '#ff4a4a', fontSize: '9px', fontFamily: 'DM Mono, monospace' }}>{error}</span>}
      </div>

      <div className="input-field-wrapper">
        <input
          type={currentType}
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="input-field"
          style={error ? { borderColor: '#ff4a4a' } : undefined}
        />

        {isPassword && (
          <button
            type="button"
            className="input-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? 'HIDE' : 'SHOW'}
          </button>
        )}
      </div>
    </div>
  )
}

export default AuthInput
