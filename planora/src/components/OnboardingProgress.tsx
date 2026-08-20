import React from 'react'

interface OnboardingProgressProps {
  currentStep: number // 1, 2, or 3
}

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({ currentStep }) => {
  return (
    <header className="onboarding-header">
      <div className="onboarding-brand">
        PLANORA<span>+</span>
      </div>
      <div className="onboarding-meta-label">
        PLANORA / DESIGN SETUP
      </div>

      <div className="onboarding-steps-tracker">
        <span className="step-indicator-text">
          0{currentStep} / 03
        </span>

        <div className="step-progress-dots">
          <span className={`step-dot-item ${currentStep >= 1 ? 'active' : ''}`}>01</span>
          <div className={`step-dot-line ${currentStep >= 2 ? 'active' : ''}`} />
          <span className={`step-dot-item ${currentStep >= 2 ? 'active' : ''}`}>02</span>
          <div className={`step-dot-line ${currentStep >= 3 ? 'active' : ''}`} />
          <span className={`step-dot-item ${currentStep >= 3 ? 'active' : ''}`}>03</span>
        </div>
      </div>
    </header>
  )
}

export default OnboardingProgress
