import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Compass, ShieldCheck, Box, MessageSquare } from 'lucide-react'
import '../styles/AuthOnboarding.css'

const Welcome: React.FC = () => {
  const navigate = useNavigate()

  const handleStartPlanning = () => {
    // Navigate to clean /generate page
    navigate('/generate')
  }

  const handleLogout = () => {
    localStorage.removeItem('planora_user')
    localStorage.removeItem('planora_project')
    navigate('/login')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030506',
        color: '#f5f5f2',
        fontFamily: "'Manrope', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* BACKGROUND BLUEPRINT GRID & AMBIENT GLOW */}
      <div className="canvas-blueprint-grid" style={{ opacity: 0.35 }} />
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(125, 231, 255, 0.09) 0%, rgba(3, 5, 6, 0) 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* HEADER */}
      <header
        style={{
          height: '70px',
          padding: '0 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(3, 5, 6, 0.8)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
        }}
      >
        <div
          className="onboarding-brand"
          style={{ cursor: 'pointer', fontSize: '20px' }}
          onClick={() => navigate('/')}
        >
          PLANORA<span>+</span>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              color: '#7de7ff',
              background: 'rgba(125, 231, 255, 0.06)',
              border: '1px solid rgba(125, 231, 255, 0.2)',
              padding: '6px 12px',
              borderRadius: '20px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#7de7ff',
                boxShadow: '0 0 8px #7de7ff',
              }}
            />
            SPATIAL AI CORE // ACTIVE
          </div>

          <button
            className="technical-btn"
            onClick={handleLogout}
            style={{ padding: '8px 16px', fontSize: '10px' }}
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px 60px 20px',
          zIndex: 5,
          maxWidth: '1100px',
          margin: '0 auto',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* BADGE */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(125, 231, 255, 0.05)',
            border: '1px solid rgba(125, 231, 255, 0.25)',
            padding: '6px 16px',
            borderRadius: '4px',
            marginBottom: '24px',
          }}
        >
          <Sparkles size={14} color="#7de7ff" />
          <span
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.15em',
              color: '#7de7ff',
            }}
          >
            AI-POWERED ARCHITECTURAL SYNTHESIS
          </span>
        </div>

        {/* HEADLINE */}
        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: '800',
            letterSpacing: '-0.03em',
            lineHeight: '1.1',
            margin: '0 0 16px 0',
            textTransform: 'uppercase',
          }}
        >
          WELCOME TO <span style={{ color: '#7de7ff' }}>PLANORA</span>
        </h1>

        {/* SUBTITLE */}
        <p
          style={{
            fontSize: 'clamp(18px, 2.5vw, 24px)',
            fontWeight: '400',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: '0 0 12px 0',
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          Let’s design your space.
        </p>

        <p
          style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.55)',
            maxWidth: '640px',
            lineHeight: '1.6',
            margin: '0 0 40px 0',
          }}
        >
          Describe your ideal residential layout in plain words. Our fine-tuned neural spatial engine
          will understand your requirements, verify 11 structural constraints, and render an instant
          architectural blueprint.
        </p>

        {/* PRIMARY CTA: START PLANNING */}
        <div style={{ marginBottom: '50px' }}>
          <button
            onClick={handleStartPlanning}
            style={{
              background: '#7de7ff',
              color: '#030506',
              border: 'none',
              padding: '18px 48px',
              fontSize: '14px',
              fontWeight: '800',
              fontFamily: 'DM Mono, monospace',
              letterSpacing: '0.12em',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 0 30px rgba(125, 231, 255, 0.35)',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 0 45px rgba(125, 231, 255, 0.55)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 0 30px rgba(125, 231, 255, 0.35)'
            }}
          >
            START PLANNING
            <ArrowRight size={18} />
          </button>

          <div
            style={{
              fontSize: '10px',
              fontFamily: 'DM Mono, monospace',
              color: 'rgba(255, 255, 255, 0.4)',
              marginTop: '12px',
              letterSpacing: '0.05em',
            }}
          >
            PROMPT // CONVERSATIONAL ASSISTANT // 2D BLUEPRINTS
          </div>
        </div>

        {/* 4 FEATURE HIGHLIGHT CARDS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            width: '100%',
            textAlign: 'left',
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '20px',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(125, 231, 255, 0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '4px',
                background: 'rgba(125, 231, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <MessageSquare size={18} color="#7de7ff" />
            </div>
            <h3 style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 6px 0', color: '#f5f5f2' }}>
              1. Conversational Prompt
            </h3>
            <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', margin: 0, lineHeight: '1.5' }}>
              State your plot size and rooms. Planora asks follow-up questions to fill in any missing details.
            </p>
          </div>

          {/* Card 2 */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '20px',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(125, 231, 255, 0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '4px',
                background: 'rgba(125, 231, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Compass size={18} color="#7de7ff" />
            </div>
            <h3 style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 6px 0', color: '#f5f5f2' }}>
              2. Structured Confirmation
            </h3>
            <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', margin: 0, lineHeight: '1.5' }}>
              Review "Here’s what I understood" summary, adjust counts with one-tap steppers, and confirm.
            </p>
          </div>

          {/* Card 3 */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '20px',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(125, 231, 255, 0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '4px',
                background: 'rgba(125, 231, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <ShieldCheck size={18} color="#7de7ff" />
            </div>
            <h3 style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 6px 0', color: '#f5f5f2' }}>
              3. 11-Rule Validation
            </h3>
            <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', margin: 0, lineHeight: '1.5' }}>
              FLAN-T5 layout tokens pass strict boundary, overlap, and dimension verification before rendering.
            </p>
          </div>

          {/* Card 4 */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '20px',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(125, 231, 255, 0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '4px',
                background: 'rgba(125, 231, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Box size={18} color="#7de7ff" />
            </div>
            <h3 style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 6px 0', color: '#f5f5f2' }}>
              4. 2D SVG & 3D Spec
            </h3>
            <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', margin: 0, lineHeight: '1.5' }}>
              Interact with vector blueprints, zoom, export SVG, or inspect coordinate payloads ready for Three.js.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Welcome
