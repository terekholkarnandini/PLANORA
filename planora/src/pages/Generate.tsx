import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OnboardingData } from './Onboarding'
import '../styles/AuthOnboarding.css'

const Generate: React.FC = () => {
  const navigate = useNavigate()
  const [projectData, setProjectData] = useState<OnboardingData | null>(null)

  useEffect(() => {
    const dataStr = localStorage.getItem('planora_project')
    if (dataStr) {
      try {
        setProjectData(JSON.parse(dataStr))
      } catch (err) {
        console.error('Error parsing project data:', err)
      }
    }
  }, [])

  const handleReset = () => {
    localStorage.removeItem('planora_project')
    navigate('/onboarding')
  }

  const handleLogout = () => {
    localStorage.removeItem('planora_user')
    localStorage.removeItem('planora_project')
    navigate('/')
  }

  return (
    <div className="generate-container">
      {/* HEADER */}
      <header className="generate-header">
        <div className="onboarding-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          PLANORA<span>+</span>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'rgba(255, 255, 255, 0.4)' }}>
            SPATIAL GENERATOR v1.0
          </span>
          <button className="technical-btn" onClick={handleLogout} style={{ padding: '8px 16px', fontSize: '8px' }}>
            LOGOUT
          </button>
        </div>
      </header>

      <div className="generate-body">
        {/* SIDEBAR: SPACE SPECIFICATIONS */}
        <aside className="generate-sidebar">
          <div>
            <h2 className="sidebar-title">SPACE PARAMETERS</h2>
            <div className="divider-line" style={{ margin: '15px 0' }} />
          </div>

          <div className="sidebar-data-group">
            <div className="sidebar-data-item">
              <label>PROJECT TYPE</label>
              <span>{projectData?.projectType || 'NEW HOME'}</span>
            </div>

            <div className="sidebar-data-item">
              <label>PLOT / AREA</label>
              <span>{projectData?.area || '1200 SQ.FT.'}</span>
            </div>

            <div className="sidebar-data-item">
              <label>LAYOUT CONFIG</label>
              <span>
                {projectData?.bedrooms || 3} BHK / {projectData?.bathrooms || 2} BATH
              </span>
            </div>

            <div className="sidebar-data-item">
              <label>FLOORS</label>
              <span>{projectData?.floors || 1} STORY</span>
            </div>

            <div className="sidebar-data-item">
              <label>ARCHITECTURAL STYLE</label>
              <span>{projectData?.preferredStyle || 'MODERN'}</span>
            </div>

            <div className="sidebar-data-item">
              <label>PLOT GEOMETRY</label>
              <span>{projectData?.plotShape || 'RECTANGULAR'}</span>
            </div>

            <div className="sidebar-data-item">
              <label>DESIGN PRIORITIES</label>
              <div className="sidebar-priorities-tags">
                {projectData?.priorities && projectData.priorities.length > 0 ? (
                  projectData.priorities.map((priority) => (
                    <span key={priority} className="priority-tag">
                      {priority}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="priority-tag">NATURAL LIGHT</span>
                    <span className="priority-tag">OPEN SPACES</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button className="technical-btn" onClick={handleReset} style={{ width: '100%' }}>
              REconfigure SPACE
            </button>
          </div>
        </aside>

        {/* WORKSPACE: ARCHITECTURAL BLUEPRINT CANVAS */}
        <main className="generate-workspace">
          <header className="workspace-header">
            <div>
              <span className="input-label" style={{ display: 'block', marginBottom: '4px' }}>
                SPATIAL AI OUTPUT / PLAN-004
              </span>
              <h1>GENERATED FLOOR PLAN</h1>
            </div>

            <div className="workspace-actions">
              <button className="technical-btn" onClick={() => alert('Simulated CAD export starting...')}>
                EXPORT CAD
              </button>
              <button className="technical-btn" style={{ borderColor: '#7de7ff', color: '#7de7ff' }} onClick={() => alert('Launching immersive 3D viewer...')}>
                RENDER 3D VIEW
              </button>
            </div>
          </header>

          <section className="workspace-canvas">
            <div className="canvas-blueprint-grid" />

            <div className="canvas-center-model">
              <div
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: '9px',
                  letterSpacing: '0.2em',
                  color: '#7de7ff',
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span className="tag-dot" /> SPATIAL DATA SYNTHESIS READY
              </div>

              <h3>INTELLIGENT LAYOUT READY</h3>
              <p>
                Your custom floor plan has been optimized and validated against all structural
                and spatial constraints.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '15px',
                  marginTop: '30px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '20px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderRadius: '4px',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div className="input-label" style={{ fontSize: '7px' }}>
                    MATCH SCORE
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#7de7ff', marginTop: '4px' }}>
                    98.4%
                  </div>
                </div>
                <div>
                  <div className="input-label" style={{ fontSize: '7px' }}>
                    EST. AREA BUILD
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#f5f5f2', marginTop: '4px' }}>
                    {projectData?.area || '1,200 sq.ft.'}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default Generate
