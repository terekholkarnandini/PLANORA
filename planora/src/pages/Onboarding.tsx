import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Compass, Briefcase, RefreshCw, Sparkles } from 'lucide-react'
import OnboardingProgress from '../components/OnboardingProgress'
import SelectionCard from '../components/SelectionCard'
import LoadingTransition from '../components/LoadingTransition'
import '../styles/AuthOnboarding.css'

export interface OnboardingData {
  projectType: string
  area: string
  bedrooms: number
  bathrooms: number
  floors: number
  preferredStyle: string
  plotShape: string
  priorities: string[]
}

const Onboarding: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [showTransition, setShowTransition] = useState(false)

  // State matching data structure
  const [formData, setFormData] = useState<OnboardingData>({
    projectType: '',
    area: '',
    bedrooms: 3,
    bathrooms: 2,
    floors: 1,
    preferredStyle: '',
    plotShape: '',
    priorities: [],
  })

  const [validationError, setValidationError] = useState('')

  // Step 1 helper functions
  const handleSelectProjectType = (type: string) => {
    setFormData((prev) => ({ ...prev, projectType: type }))
    setValidationError('')
  }

  const nextStep = () => {
    if (step === 1 && !formData.projectType) {
      setValidationError('PLEASE SELECT A PROJECT TYPE TO CONTINUE.')
      return
    }
    if (step === 2) {
      if (!formData.area.trim()) {
        setValidationError('PLEASE ENTER PLOT AREA.')
        return
      }
      if (!formData.preferredStyle) {
        setValidationError('PLEASE SELECT A PREFERRED ARCHITECTURAL STYLE.')
        return
      }
      if (!formData.plotShape) {
        setValidationError('PLEASE SELECT A PLOT SHAPE.')
        return
      }
    }
    setValidationError('')
    setStep((prev) => prev + 1)
  }

  const prevStep = () => {
    setValidationError('')
    setStep((prev) => prev - 1)
  }

  // Step 2 handlers
  const handleIncrement = (field: 'bedrooms' | 'bathrooms' | 'floors') => {
    setFormData((prev) => ({ ...prev, [field]: prev[field] + 1 }))
  }

  const handleDecrement = (field: 'bedrooms' | 'bathrooms' | 'floors') => {
    setFormData((prev) => ({
      ...prev,
      [field]: Math.max(1, prev[field] - 1),
    }))
  }

  const handleSelectStyle = (style: string) => {
    setFormData((prev) => ({ ...prev, preferredStyle: style }))
  }

  const handleSelectShape = (shape: string) => {
    setFormData((prev) => ({ ...prev, plotShape: shape }))
  }

  // Step 3 priorities toggling
  const handleTogglePriority = (priority: string) => {
    setFormData((prev) => {
      const active = prev.priorities.includes(priority)
        ? prev.priorities.filter((p) => p !== priority)
        : [...prev.priorities, priority]
      return { ...prev, priorities: active }
    })
  }

  const handleGenerate = () => {
    if (formData.priorities.length === 0) {
      setValidationError('PLEASE SELECT AT LEAST ONE DESIGN PRIORITY.')
      return
    }
    setValidationError('')
    setShowTransition(true)
  }

  const handleTransitionComplete = () => {
    // Save state to localStorage for the next page to read
    localStorage.setItem('planora_project', JSON.stringify(formData))
    navigate('/generate')
  }

  return (
    <div className="onboarding-container">
      {showTransition ? (
        <LoadingTransition onComplete={handleTransitionComplete} />
      ) : (
        <>
          <OnboardingProgress currentStep={step} />

          <main className="onboarding-main">
            <div className="onboarding-content-card">
              {validationError && (
                <div
                  className="auth-error"
                  style={{ marginBottom: '24px', textAlign: 'center' }}
                >
                  {validationError}
                </div>
              )}

              {/* ==========================================
                  STEP 1: WHAT ARE YOU DESIGNING?
                  ========================================== */}
              {step === 1 && (
                <section>
                  <header className="onboarding-step-header">
                    <h2>WHAT ARE YOU DESIGNING?</h2>
                    <p>Tell Planora what kind of space you want to create.</p>
                  </header>

                  <div className="onboarding-grid">
                    <SelectionCard
                      title="NEW HOME"
                      description="Design a new residential space from the ground up."
                      isSelected={formData.projectType === 'NEW HOME'}
                      onClick={() => handleSelectProjectType('NEW HOME')}
                      icon={<Home strokeWidth={1.5} size={28} />}
                    />
                    <SelectionCard
                      title="APARTMENT"
                      description="Plan and optimize an apartment layout."
                      isSelected={formData.projectType === 'APARTMENT'}
                      onClick={() => handleSelectProjectType('APARTMENT')}
                      icon={<Compass strokeWidth={1.5} size={28} />}
                    />
                    <SelectionCard
                      title="OFFICE"
                      description="Create a productive and functional workspace."
                      isSelected={formData.projectType === 'OFFICE'}
                      onClick={() => handleSelectProjectType('OFFICE')}
                      icon={<Briefcase strokeWidth={1.5} size={28} />}
                    />
                    <SelectionCard
                      title="RENOVATION"
                      description="Reimagine and improve an existing space."
                      isSelected={formData.projectType === 'RENOVATION'}
                      onClick={() => handleSelectProjectType('RENOVATION')}
                      icon={<RefreshCw strokeWidth={1.5} size={28} />}
                    />
                    <SelectionCard
                      title="OTHER"
                      description="Start with a custom architectural idea."
                      isSelected={formData.projectType === 'OTHER'}
                      onClick={() => handleSelectProjectType('OTHER')}
                      icon={<Sparkles strokeWidth={1.5} size={28} />}
                    />
                  </div>

                  <div className="onboarding-actions-row" style={{ justifyContent: 'flex-end' }}>
                    <button className="primary-btn" onClick={nextStep}>
                      CONTINUE <span className="arrow">→</span>
                    </button>
                  </div>
                </section>
              )}

              {/* ==========================================
                  STEP 2: TELL US ABOUT YOUR SPACE
                  ========================================== */}
              {step === 2 && (
                <section>
                  <header className="onboarding-step-header">
                    <h2>TELL US ABOUT YOUR SPACE</h2>
                    <p>Give us a few details so Planora can understand your spatial requirements.</p>
                  </header>

                  <div className="details-form">
                    <div className="details-row">
                      {/* PLOT AREA */}
                      <div className="input-group">
                        <span className="input-label">PLOT / AREA</span>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. 1200 sq.ft."
                          value={formData.area}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, area: e.target.value }))
                          }
                        />
                      </div>

                      {/* BEDROOMS */}
                      <div className="input-group">
                        <span className="input-label">BEDROOMS</span>
                        <div className="stepper-container">
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleDecrement('bedrooms')}
                          >
                            −
                          </button>
                          <span className="stepper-value">{formData.bedrooms}</span>
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleIncrement('bedrooms')}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="details-row">
                      {/* BATHROOMS */}
                      <div className="input-group">
                        <span className="input-label">BATHROOMS</span>
                        <div className="stepper-container">
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleDecrement('bathrooms')}
                          >
                            −
                          </button>
                          <span className="stepper-value">{formData.bathrooms}</span>
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleIncrement('bathrooms')}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* FLOORS */}
                      <div className="input-group">
                        <span className="input-label">FLOORS</span>
                        <div className="stepper-container">
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleDecrement('floors')}
                          >
                            −
                          </button>
                          <span className="stepper-value">{formData.floors}</span>
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => handleIncrement('floors')}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* STYLE CHIPS */}
                    <div className="input-group">
                      <span className="input-label">PREFERRED STYLE</span>
                      <div className="styles-grid">
                        {['MODERN', 'MINIMAL', 'CONTEMPORARY', 'TRADITIONAL', 'LUXURY'].map(
                          (style) => (
                            <button
                              key={style}
                              type="button"
                              className={`style-chip ${formData.preferredStyle === style ? 'selected' : ''
                                }`}
                              onClick={() => handleSelectStyle(style)}
                            >
                              {style}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* PLOT SHAPE */}
                    <div className="input-group">
                      <span className="input-label">PLOT SHAPE</span>
                      <div className="shape-selectors-container">
                        {['RECTANGULAR', 'SQUARE', 'IRREGULAR', 'NOT SURE'].map((shape) => (
                          <label key={shape} className="shape-selector-item">
                            <input
                              type="radio"
                              name="plotShape"
                              checked={formData.plotShape === shape}
                              onChange={() => handleSelectShape(shape)}
                            />
                            <span className="shape-radio-dot" />
                            {shape}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="onboarding-actions-row">
                    <button className="back-btn" onClick={prevStep}>
                      ← BACK
                    </button>
                    <button className="primary-btn" onClick={nextStep}>
                      CONTINUE <span className="arrow">→</span>
                    </button>
                  </div>
                </section>
              )}

              {/* ==========================================
                  STEP 3: WHAT MATTERS MOST?
                  ========================================== */}
              {step === 3 && (
                <section>
                  <header className="onboarding-step-header">
                    <h2>WHAT MATTERS MOST?</h2>
                    <p>Choose the priorities that should influence your architectural design.</p>
                  </header>

                  <div className="priorities-grid">
                    {[
                      'NATURAL LIGHT',
                      'OPEN SPACES',
                      'MODERN DESIGN',
                      'MAXIMUM SPACE',
                    ].map((priority) => {
                      const isSelected = formData.priorities.includes(priority)
                      return (
                        <button
                          key={priority}
                          type="button"
                          className={`priority-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleTogglePriority(priority)}
                        >
                          <span className="priority-title">{priority}</span>
                          <span className="priority-checkbox" />
                        </button>
                      )
                    })}
                  </div>

                  <div className="onboarding-actions-row">
                    <button className="back-btn" onClick={prevStep}>
                      ← BACK
                    </button>
                    <button className="primary-btn" onClick={handleGenerate}>
                      GENERATE MY SPACE <span className="arrow">→</span>
                    </button>
                  </div>
                </section>
              )}
            </div>
          </main>
        </>
      )}
    </div>
  )
}

export default Onboarding
