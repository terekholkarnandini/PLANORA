import React from 'react'

interface AuthVisualProps {
  imageSrc: string
  labels: string[]
  slogans: string[]
}

const AuthVisual: React.FC<AuthVisualProps> = ({ imageSrc, labels, slogans }) => {
  return (
    <div className="auth-visual">
      <img src={imageSrc} alt="Architectural Plan Background" className="auth-visual-img" />
      <div className="auth-visual-overlay" />
      <div className="auth-visual-glow" />

      {/* TOP META DATA */}
      <header className="auth-visual-header">
        <div className="auth-logo">
          PLANORA<span>+</span>
        </div>
        <div className="auth-visual-meta">
          <span className="active-tag">SYSTEM ACTIVE</span>
          {labels.map((lbl, idx) => (
            <span key={idx}>{lbl}</span>
          ))}
        </div>
      </header>

      {/* BOTTOM SLOGANS */}
      <footer className="auth-visual-footer">
        <h2>
          {slogans.map((slogan, idx) => (
            <span key={idx}>{slogan}</span>
          ))}
        </h2>
      </footer>
    </div>
  )
}

export default AuthVisual
