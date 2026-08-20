import React, { useState, useEffect } from 'react'

interface LoadingTransitionProps {
  onComplete: () => void
}

interface StepItem {
  id: string
  label: string
}

const LoadingTransition: React.FC<LoadingTransitionProps> = ({ onComplete }) => {
  const steps: StepItem[] = [
    { id: 'reqs', label: 'ANALYZING REQUIREMENTS' },
    { id: 'consts', label: 'APPLYING SPATIAL CONSTRAINTS' },
    { id: 'layout', label: 'OPTIMIZING LAYOUT' },
    { id: 'plans', label: 'GENERATING FLOOR PLANS' },
  ]

  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (currentStepIdx < steps.length) {
      const timer = setTimeout(() => {
        setCurrentStepIdx((prev) => prev + 1)
      }, 1200) // 1.2s per step
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => {
        setIsReady(true)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [currentStepIdx])

  const getStepStatus = (idx: number) => {
    if (idx < currentStepIdx) return { text: 'COMPLETED', className: 'completed' }
    if (idx === currentStepIdx && !isReady) return { text: 'ACTIVE...', className: 'active' }
    return { text: 'PENDING', className: 'pending' }
  }

  return (
    <div className="transition-overlay">
      <div className="transition-content-box">
        {!isReady && <div className="transition-radar" />}

        <div className="transition-status-text">
          {isReady ? 'SYSTEM COMPLETE' : 'UNDERSTANDING YOUR SPACE...'}
        </div>

        <div className="transition-steps-list">
          {steps.map((step, idx) => {
            const status = getStepStatus(idx)
            return (
              <div key={step.id} className={`transition-step-row ${status.className}`}>
                <span>{step.label}</span>
                <span className="status-tag">{status.text}</span>
              </div>
            )
          })}
        </div>

        {isReady && (
          <div className="transition-ready-box">
            <h3 className="transition-ready-title">YOUR SPACE IS READY.</h3>
            <button className="primary-btn" onClick={onComplete}>
              VIEW GENERATED PLANS <span className="arrow">→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default LoadingTransition
