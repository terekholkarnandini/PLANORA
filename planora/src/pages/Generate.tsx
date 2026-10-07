import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Send,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  Building
} from 'lucide-react'
import '../styles/AuthOnboarding.css'

interface RoomItem {
  name: string
  room: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

interface ValidationReport {
  valid: boolean
  errors: string[]
  warnings: string[]
  metrics?: {
    room_count: number
    plot_area: number
    built_area: number
    doors_count: number
    windows_count: number
  }
}

interface PlanGenerationResult {
  success: boolean
  prompt: string
  requirements: {
    plot: { width: number; length: number; height: number; unit: string }
    rooms: Record<string, number>
  }
  layout: {
    plot: { width: number; height: number; length: number; unit: string }
    rooms: RoomItem[]
    doors: any[]
    windows: any[]
  }
  validation: ValidationReport
  svg: string
  was_repaired?: boolean
}

interface StructuredRequirements {
  plot: { width: number; length: number; height: number; unit: string }
  rooms: {
    bedrooms: number
    bathrooms: number
    kitchen: number
    living_room: number
    dining_room: number
    parking: number
    balcony: number
    utility: number
    study_room: number
  }
}

interface ChatMessage {
  id: string
  sender: 'ai' | 'user'
  text: string
  timestamp: string
  suggestions?: string[]
}

const SAMPLE_PROMPTS = [
  '30x40 ft house with 2 bedrooms, 2 bathrooms, 1 kitchen, 1 living room, 1 dining room and parking',
  '30x50 ft plot with 3 bedrooms, 2 bathrooms, 1 kitchen, 1 living room, dining room, balcony and parking',
  '20x40 ft house with 2 bedrooms, 1 bathroom, kitchen, living room and balcony',
  '40x60 ft luxury villa with 4 bedrooms, 3 bathrooms, kitchen, living room, dining, utility and parking',
  '20x30 ft compact home with 1 bedroom, 1 bathroom, kitchen and living room',
]

function parseRequirementsFromText(text: string): StructuredRequirements {
  const clean = text.toLowerCase()
  let width = 30
  let length = 40

  // 1. Plot dimensions
  const dimMatch = clean.match(/(\d+)\s*(?:x|by|\*)\s*(\d+)/i)
  if (dimMatch) {
    width = parseInt(dimMatch[1], 10)
    length = parseInt(dimMatch[2], 10)
  } else {
    const areaMatch = clean.match(/(\d+)\s*(?:sq\s*ft|sqft|square\s*feet)/i)
    if (areaMatch) {
      const area = parseInt(areaMatch[1], 10)
      if (area <= 650) { width = 20; length = 30 }
      else if (area <= 900) { width = 20; length = 40 }
      else if (area <= 1100) { width = 25; length = 40 }
      else if (area <= 1350) { width = 30; length = 40 }
      else if (area <= 1800) { width = 30; length = 50 }
      else { width = 40; length = 60 }
    }
  }

  // 2. Bedrooms
  let bedrooms = 0
  const bedMatch = clean.match(/(\d+)\s*(?:bhk|bed|beds|bedroom|bedrooms)/i)
  if (bedMatch) bedrooms = parseInt(bedMatch[1], 10)
  else if (clean.includes('bedroom') || clean.includes('bed')) bedrooms = 1

  // 3. Bathrooms
  let bathrooms = 0
  const bathMatch = clean.match(/(\d+)\s*(?:bath|baths|bathroom|bathrooms|toilet|toilets|washroom|wc)/i)
  if (bathMatch) bathrooms = parseInt(bathMatch[1], 10)
  else if (clean.includes('bath') || clean.includes('toilet') || clean.includes('washroom')) bathrooms = 1

  // 4. Kitchen
  let kitchen = 0
  const kitMatch = clean.match(/(\d+)\s*kitchen/i)
  if (kitMatch) kitchen = parseInt(kitMatch[1], 10)
  else if (clean.includes('kitchen') || clean.includes('cooking')) kitchen = 1

  // 5. Living room
  let living_room = 0
  const livMatch = clean.match(/(\d+)\s*(?:living|hall)/i)
  if (livMatch) living_room = parseInt(livMatch[1], 10)
  else if (clean.includes('living') || clean.includes('hall') || clean.includes('lounge')) living_room = 1

  // 6. Dining room
  let dining_room = 0
  const dinMatch = clean.match(/(\d+)\s*dining/i)
  if (dinMatch) dining_room = parseInt(dinMatch[1], 10)
  else if (clean.includes('dining')) dining_room = 1

  // 7. Parking
  let parking = 0
  const parkMatch = clean.match(/(\d+)\s*(?:parking|garage|car)/i)
  if (parkMatch) parking = parseInt(parkMatch[1], 10)
  else if (clean.includes('parking') || clean.includes('garage') || clean.includes('car porch') || clean.includes('porch')) parking = 1

  // 8. Balcony
  let balcony = 0
  const balcMatch = clean.match(/(\d+)\s*(?:balcony|balconies|terrace)/i)
  if (balcMatch) balcony = parseInt(balcMatch[1], 10)
  else if (clean.includes('balcony') || clean.includes('terrace')) balcony = 1

  return {
    plot: { width, length, height: 10, unit: 'ft' },
    rooms: {
      bedrooms: bedrooms || (clean.trim() ? 2 : 0),
      bathrooms: bathrooms || (clean.trim() ? 2 : 0),
      kitchen,
      living_room,
      dining_room,
      parking,
      balcony,
      utility: 0,
      study_room: 0,
    },
  }
}

function compilePromptFromRequirements(req: StructuredRequirements): string {
  const parts: string[] = []
  parts.push(`${req.plot.width}x${req.plot.length} ft house with`)
  const roomParts: string[] = []
  if (req.rooms.bedrooms > 0) roomParts.push(`${req.rooms.bedrooms} bedroom${req.rooms.bedrooms > 1 ? 's' : ''}`)
  if (req.rooms.bathrooms > 0) roomParts.push(`${req.rooms.bathrooms} bathroom${req.rooms.bathrooms > 1 ? 's' : ''}`)
  if (req.rooms.kitchen > 0) roomParts.push(`${req.rooms.kitchen} kitchen`)
  if (req.rooms.living_room > 0) roomParts.push(`${req.rooms.living_room} living room`)
  if (req.rooms.dining_room > 0) roomParts.push(`${req.rooms.dining_room} dining room`)
  if (req.rooms.balcony > 0) roomParts.push(`${req.rooms.balcony} balcony`)
  if (req.rooms.parking > 0) roomParts.push('parking')
  if (req.rooms.utility > 0) roomParts.push(`${req.rooms.utility} utility`)
  if (req.rooms.study_room > 0) roomParts.push(`${req.rooms.study_room} study room`)

  if (roomParts.length === 0) {
    return `${req.plot.width}x${req.plot.length} ft house with 2 bedrooms, 2 bathrooms, 1 kitchen, 1 living room, 1 dining room and parking`
  }

  if (roomParts.length === 1) return `${parts[0]} ${roomParts[0]}`
  const last = roomParts.pop()
  return `${parts[0]} ${roomParts.join(', ')} and ${last}`
}

const Generate: React.FC = () => {
  const navigate = useNavigate()

  // Workflow Step: 'chat' (Prompt/AI conversation) -> 'confirm' (Here's what I understood) -> 'generated' (2D Floor Plan)
  const [workflowStep, setWorkflowStep] = useState<'chat' | 'confirm' | 'generated'>('chat')

  // Inputs & Chat State (Initially completely empty)
  const [prompt, setPrompt] = useState<string>('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [requirements, setRequirements] = useState<StructuredRequirements | null>(null)

  // Plan generation state
  const [loading, setLoading] = useState<boolean>(false)
  const [planResult, setPlanResult] = useState<PlanGenerationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [svgZoom, setSvgZoom] = useState<number>(1)
  const [show3DModal, setShow3DModal] = useState<boolean>(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  // Handle user submitting text into the prompt/AI conversation
  const handleSendPrompt = (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : prompt
    if (!rawText.trim()) return

    const userText = rawText.trim()
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // User message
    const newMessages: ChatMessage[] = [
      ...chatMessages,
      {
        id: Math.random().toString(),
        sender: 'user',
        text: userText,
        timestamp: now,
      },
    ]

    // Extract requirements from user text and merge with existing requirements if any
    const parsed = parseRequirementsFromText(userText)
    const currentReq: StructuredRequirements = requirements
      ? {
          plot: {
            width: userText.match(/\d+\s*(?:x|by|\*)\s*\d+/i) ? parsed.plot.width : requirements.plot.width,
            length: userText.match(/\d+\s*(?:x|by|\*)\s*\d+/i) ? parsed.plot.length : requirements.plot.length,
            height: 10,
            unit: 'ft',
          },
          rooms: {
            bedrooms: parsed.rooms.bedrooms || requirements.rooms.bedrooms,
            bathrooms: parsed.rooms.bathrooms || requirements.rooms.bathrooms,
            kitchen: parsed.rooms.kitchen || requirements.rooms.kitchen,
            living_room: parsed.rooms.living_room || requirements.rooms.living_room,
            dining_room: parsed.rooms.dining_room || requirements.rooms.dining_room,
            parking: parsed.rooms.parking || requirements.rooms.parking,
            balcony: parsed.rooms.balcony || requirements.rooms.balcony,
            utility: parsed.rooms.utility || requirements.rooms.utility,
            study_room: parsed.rooms.study_room || requirements.rooms.study_room,
          },
        }
      : parsed

    setRequirements(currentReq)
    setPrompt('')

    // Generate AI follow-up & missing requirements suggestions
    const suggestions: string[] = []
    const missingParts: string[] = []

    if (currentReq.rooms.kitchen === 0) {
      missingParts.push('kitchen')
      suggestions.push('+ Add Kitchen')
    }
    if (currentReq.rooms.living_room === 0) {
      missingParts.push('living room')
      suggestions.push('+ Add Living Room')
    }
    if (currentReq.rooms.parking === 0) {
      missingParts.push('parking space')
      suggestions.push('+ Add Parking')
    }
    if (currentReq.rooms.dining_room === 0) {
      suggestions.push('+ Add Dining Room')
    }
    if (currentReq.rooms.balcony === 0) {
      suggestions.push('+ Add Balcony')
    }

    let aiResponseText = `I have recorded a ${currentReq.plot.width}×${currentReq.plot.length} FT plot with ${currentReq.rooms.bedrooms} Bedroom${currentReq.rooms.bedrooms > 1 ? 's' : ''} and ${currentReq.rooms.bathrooms} Bathroom${currentReq.rooms.bathrooms > 1 ? 's' : ''}.`

    if (missingParts.length > 0) {
      aiResponseText += ` Would you like to include a ${missingParts.join(' and ')}? You can click the quick options below or reply in chat.`
    } else {
      aiResponseText += ` All essential spaces are covered! You can proceed to confirm your requirements or adjust options.`
    }

    newMessages.push({
      id: Math.random().toString(),
      sender: 'ai',
      text: aiResponseText,
      timestamp: now,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    })

    setChatMessages(newMessages)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // Quick suggestion click
  const handleSelectSuggestion = (suggestion: string) => {
    if (!requirements) return

    const updated = { ...requirements, rooms: { ...requirements.rooms } }

    if (suggestion === '+ Add Kitchen') updated.rooms.kitchen = 1
    else if (suggestion === '+ Add Living Room') updated.rooms.living_room = 1
    else if (suggestion === '+ Add Parking') updated.rooms.parking = 1
    else if (suggestion === '+ Add Dining Room') updated.rooms.dining_room = 1
    else if (suggestion === '+ Add Balcony') updated.rooms.balcony = 1

    setRequirements(updated)

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const newMessages: ChatMessage[] = [
      ...chatMessages,
      {
        id: Math.random().toString(),
        sender: 'user',
        text: `Included ${suggestion.replace('+ Add ', '')}.`,
        timestamp: now,
      },
      {
        id: Math.random().toString(),
        sender: 'ai',
        text: `Updated requirements with ${suggestion.replace('+ Add ', '')}. Ready to review and generate!`,
        timestamp: now,
      },
    ]
    setChatMessages(newMessages)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // Transition from Chat to Confirmation screen
  const handleProceedToConfirm = () => {
    if (!requirements) {
      // If user clicks review with empty chat, use default fallback
      const def = parseRequirementsFromText(prompt || '30x40 ft house with 2 bedrooms and 2 bathrooms')
      setRequirements(def)
    }
    setWorkflowStep('confirm')
  }

  // Execute Generate Floor Plan API call
  const handleExecuteGeneration = async () => {
    if (!requirements) return

    const finalPrompt = compilePromptFromRequirements(requirements)
    setLoading(true)
    setErrorMessage(null)
    setWorkflowStep('generated')

    try {
      const response = await fetch(`${backendUrl}/generate-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: finalPrompt }),
      })

      if (!response.ok) {
        const errDetail = await response.json().catch(() => ({}))
        throw new Error(errDetail.detail || `Server error (${response.status})`)
      }

      const data: PlanGenerationResult = await response.json()
      setPlanResult(data)
    } catch (err: any) {
      console.error('Generation failed:', err)
      setErrorMessage(
        err.message || 'Failed to connect to PLANORA Backend. Please ensure server is running on port 8000.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleResetAll = () => {
    setWorkflowStep('chat')
    setPrompt('')
    setChatMessages([])
    setRequirements(null)
    setPlanResult(null)
    setErrorMessage(null)
  }

  const handleLogout = () => {
    localStorage.removeItem('planora_user')
    localStorage.removeItem('planora_project')
    navigate('/login')
  }

  const handleDownloadSVG = () => {
    if (!planResult?.svg) return
    const blob = new Blob([planResult.svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `planora-${planResult.layout?.plot?.width || 30}x${planResult.layout?.plot?.length || 40}-floorplan.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="generate-container">
      {/* HEADER */}
      <header className="generate-header">
        <div className="onboarding-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/welcome')}>
          PLANORA<span>+</span>
        </div>

        {/* WORKFLOW STEP INDICATOR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '4px',
              background: workflowStep === 'chat' ? 'rgba(125, 231, 255, 0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${workflowStep === 'chat' ? '#7de7ff' : 'rgba(255,255,255,0.08)'}`,
              color: workflowStep === 'chat' ? '#7de7ff' : 'rgba(255,255,255,0.4)',
              fontSize: '10px',
              fontFamily: 'DM Mono, monospace',
            }}
          >
            <span>1</span> PROMPT & CHAT
          </div>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>→</span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '4px',
              background: workflowStep === 'confirm' ? 'rgba(125, 231, 255, 0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${workflowStep === 'confirm' ? '#7de7ff' : 'rgba(255,255,255,0.08)'}`,
              color: workflowStep === 'confirm' ? '#7de7ff' : 'rgba(255,255,255,0.4)',
              fontSize: '10px',
              fontFamily: 'DM Mono, monospace',
            }}
          >
            <span>2</span> CONFIRM REQUIREMENTS
          </div>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>→</span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '4px',
              background: workflowStep === 'generated' ? 'rgba(125, 231, 255, 0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${workflowStep === 'generated' ? '#7de7ff' : 'rgba(255,255,255,0.08)'}`,
              color: workflowStep === 'generated' ? '#7de7ff' : 'rgba(255,255,255,0.4)',
              fontSize: '10px',
              fontFamily: 'DM Mono, monospace',
            }}
          >
            <span>3</span> 2D BLUEPRINT
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button className="technical-btn" onClick={handleResetAll} style={{ padding: '8px 16px', fontSize: '9px' }}>
            NEW PLAN
          </button>
          <button className="technical-btn" onClick={handleLogout} style={{ padding: '8px 16px', fontSize: '9px' }}>
            LOGOUT
          </button>
        </div>
      </header>

      <div className="generate-body">
        {/* =========================================================================
            STAGE 1: PROMPT & CONVERSATIONAL ASSISTANT VIEW (LEFT SIDEBAR OR FULL VIEW)
            ========================================================================= */}
        {workflowStep === 'chat' && (
          <aside className="generate-sidebar" style={{ width: '420px', display: 'flex', flexDirection: 'column' }}>
            {/* PANEL HEADER */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: '#7de7ff', letterSpacing: '0.1em' }}>
                  STEP 1 // NATURAL LANGUAGE INPUT
                </span>
                <span
                  style={{
                    fontSize: '8px',
                    fontFamily: 'DM Mono',
                    color: '#7de7ff',
                    border: '1px solid rgba(125,231,255,0.3)',
                    padding: '2px 6px',
                    borderRadius: '2px',
                  }}
                >
                  AI ASSISTANT
                </span>
              </div>
              <h2 style={{ fontSize: '15px', fontWeight: '800', margin: 0, letterSpacing: '-0.01em' }}>
                DESCRIBE YOUR SPACE
              </h2>
            </div>

            {/* CHAT MESSAGES STREAM */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {chatMessages.length === 0 ? (
                <div
                  style={{
                    background: 'rgba(125, 231, 255, 0.02)',
                    border: '1px dashed rgba(125, 231, 255, 0.15)',
                    borderRadius: '6px',
                    padding: '20px',
                    textAlign: 'center',
                  }}
                >
                  <Bot size={28} color="#7de7ff" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                  <h4 style={{ fontSize: '12px', margin: '0 0 6px 0', color: '#f5f5f2' }}>
                    Welcome to Planora Assistant
                  </h4>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: '1.5' }}>
                    Type your requirements below (e.g. <i>"I want a 30x40 house with 2 bedrooms and 2 bathrooms"</i>) or select a starting example.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px',
                        fontSize: '9px',
                        fontFamily: 'DM Mono',
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {msg.sender === 'ai' ? <Bot size={12} color="#7de7ff" /> : <User size={12} />}
                      <span>{msg.sender === 'ai' ? 'PLANORA AI' : 'YOU'}</span>
                      <span>·</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      style={{
                        maxWidth: '90%',
                        padding: '12px 14px',
                        borderRadius: msg.sender === 'user' ? '8px 8px 0px 8px' : '8px 8px 8px 0px',
                        background: msg.sender === 'user' ? '#1E293B' : 'rgba(125, 231, 255, 0.06)',
                        border: `1px solid ${msg.sender === 'user' ? 'rgba(255,255,255,0.15)' : 'rgba(125, 231, 255, 0.25)'}`,
                        color: '#f5f5f2',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        fontFamily: "'Manrope', sans-serif",
                      }}
                    >
                      {msg.text}
                    </div>

                    {/* SUGGESTION PILLS */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSelectSuggestion(sug)}
                            style={{
                              background: 'rgba(125, 231, 255, 0.08)',
                              border: '1px solid rgba(125, 231, 255, 0.3)',
                              color: '#7de7ff',
                              padding: '5px 10px',
                              borderRadius: '20px',
                              fontSize: '10px',
                              fontFamily: 'DM Mono, monospace',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(125, 231, 255, 0.2)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(125, 231, 255, 0.08)')}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* QUICK PRESETS CHIPS (FILL PROMPT BOX ONLY, NO AUTO GENERATE) */}
            <div style={{ padding: '12px 24px 0 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span
                style={{
                  fontSize: '8px',
                  fontFamily: 'DM Mono',
                  color: 'rgba(255, 255, 255, 0.4)',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                STARTING TEMPLATES (FILLS INPUT):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {SAMPLE_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPrompt(p)
                      textareaRef.current?.focus()
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'rgba(255, 255, 255, 0.65)',
                      padding: '4px 8px',
                      fontSize: '8px',
                      fontFamily: 'DM Mono',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#7de7ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
                  >
                    {p.split('with')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* INPUT TEXTAREA & ACTION BUTTONS */}
            <div style={{ padding: '16px 24px 24px 24px' }}>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendPrompt()
                    }
                  }}
                  placeholder="e.g. I want a 30x40 house with 2 bedrooms and 2 bathrooms..."
                  rows={3}
                  style={{
                    width: '100%',
                    background: 'rgba(3, 5, 6, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f5f5f2',
                    borderRadius: '6px',
                    padding: '12px 42px 12px 12px',
                    fontSize: '12px',
                    fontFamily: 'DM Mono, monospace',
                    resize: 'none',
                    boxSizing: 'border-box',
                    outline: 'none',
                    lineHeight: '1.5',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#7de7ff')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)')}
                />

                <button
                  onClick={() => handleSendPrompt()}
                  disabled={!prompt.trim()}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    bottom: '14px',
                    background: prompt.trim() ? '#7de7ff' : 'rgba(255,255,255,0.1)',
                    color: prompt.trim() ? '#030506' : 'rgba(255,255,255,0.3)',
                    border: 'none',
                    borderRadius: '4px',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Send size={14} />
                </button>
              </div>

              {/* CONFIRM BUTTON ONCE REQUIREMENTS EXIST */}
              {requirements && (
                <button
                  className="technical-btn"
                  onClick={handleProceedToConfirm}
                  style={{
                    width: '100%',
                    marginTop: '12px',
                    background: '#7de7ff',
                    color: '#030506',
                    fontWeight: '800',
                    border: 'none',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  REVIEW & CONFIRM REQUIREMENTS
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </aside>
        )}

        {/* =========================================================================
            STAGE 2: “HERE’S WHAT I UNDERSTOOD” CONFIRMATION VIEW
            ========================================================================= */}
        {workflowStep === 'confirm' && requirements && (
          <aside className="generate-sidebar" style={{ width: '450px', overflowY: 'auto' }}>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span
                  style={{
                    fontFamily: 'DM Mono',
                    fontSize: '9px',
                    color: '#7de7ff',
                    border: '1px solid #7de7ff',
                    padding: '2px 6px',
                    borderRadius: '2px',
                  }}
                >
                  STEP 2 // VERIFICATION
                </span>
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
                HERE’S WHAT I UNDERSTOOD
              </h2>
              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', margin: '0 0 20px 0' }}>
                Review and fine-tune your structured specifications before generating the blueprint.
              </p>

              {/* 1. PLOT ENVELOPE */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '9px', fontFamily: 'DM Mono', color: '#7de7ff' }}>PLOT DIMENSIONS</span>
                  <span style={{ fontSize: '11px', fontFamily: 'DM Mono', color: 'rgba(255,255,255,0.6)' }}>
                    {requirements.plot.width * requirements.plot.length} SQ.FT
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '8px', fontFamily: 'DM Mono', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>
                      WIDTH (FT)
                    </label>
                    <input
                      type="number"
                      value={requirements.plot.width}
                      onChange={(e) =>
                        setRequirements({
                          ...requirements,
                          plot: { ...requirements.plot, width: Math.max(15, parseInt(e.target.value) || 30) },
                        })
                      }
                      style={{
                        width: '100%',
                        background: '#030506',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        padding: '8px',
                        borderRadius: '4px',
                        fontFamily: 'DM Mono',
                        fontSize: '13px',
                      }}
                    />
                  </div>

                  <span style={{ color: 'rgba(255,255,255,0.3)', marginTop: '16px' }}>×</span>

                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '8px', fontFamily: 'DM Mono', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>
                      LENGTH (FT)
                    </label>
                    <input
                      type="number"
                      value={requirements.plot.length}
                      onChange={(e) =>
                        setRequirements({
                          ...requirements,
                          plot: { ...requirements.plot, length: Math.max(20, parseInt(e.target.value) || 40) },
                        })
                      }
                      style={{
                        width: '100%',
                        background: '#030506',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        padding: '8px',
                        borderRadius: '4px',
                        fontFamily: 'DM Mono',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. ROOM COUNTS & TOGGLES */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <span style={{ fontSize: '9px', fontFamily: 'DM Mono', color: '#7de7ff', display: 'block', marginBottom: '12px' }}>
                  ROOM PROGRAM
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* BEDROOMS */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#f5f5f2' }}>Bedrooms</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() =>
                          setRequirements({
                            ...requirements,
                            rooms: { ...requirements.rooms, bedrooms: Math.max(1, requirements.rooms.bedrooms - 1) },
                          })
                        }
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff',
                          width: '24px',
                          height: '24px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontFamily: 'DM Mono', fontSize: '13px', width: '20px', textAlign: 'center', color: '#7de7ff' }}>
                        {requirements.rooms.bedrooms}
                      </span>
                      <button
                        onClick={() =>
                          setRequirements({
                            ...requirements,
                            rooms: { ...requirements.rooms, bedrooms: Math.min(5, requirements.rooms.bedrooms + 1) },
                          })
                        }
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff',
                          width: '24px',
                          height: '24px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* BATHROOMS */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#f5f5f2' }}>Bathrooms</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() =>
                          setRequirements({
                            ...requirements,
                            rooms: { ...requirements.rooms, bathrooms: Math.max(1, requirements.rooms.bathrooms - 1) },
                          })
                        }
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff',
                          width: '24px',
                          height: '24px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontFamily: 'DM Mono', fontSize: '13px', width: '20px', textAlign: 'center', color: '#7de7ff' }}>
                        {requirements.rooms.bathrooms}
                      </span>
                      <button
                        onClick={() =>
                          setRequirements({
                            ...requirements,
                            rooms: { ...requirements.rooms, bathrooms: Math.min(4, requirements.rooms.bathrooms + 1) },
                          })
                        }
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff',
                          width: '24px',
                          height: '24px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* KITCHEN TOGGLE */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#f5f5f2' }}>Kitchen</span>
                    <button
                      onClick={() =>
                        setRequirements({
                          ...requirements,
                          rooms: { ...requirements.rooms, kitchen: requirements.rooms.kitchen > 0 ? 0 : 1 },
                        })
                      }
                      style={{
                        background: requirements.rooms.kitchen > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${requirements.rooms.kitchen > 0 ? '#10B981' : 'rgba(255,255,255,0.15)'}`,
                        color: requirements.rooms.kitchen > 0 ? '#10B981' : 'rgba(255,255,255,0.4)',
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontFamily: 'DM Mono',
                        cursor: 'pointer',
                      }}
                    >
                      {requirements.rooms.kitchen > 0 ? '✓ INCLUDED' : 'OMIT'}
                    </button>
                  </div>

                  {/* LIVING ROOM TOGGLE */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#f5f5f2' }}>Living Room</span>
                    <button
                      onClick={() =>
                        setRequirements({
                          ...requirements,
                          rooms: { ...requirements.rooms, living_room: requirements.rooms.living_room > 0 ? 0 : 1 },
                        })
                      }
                      style={{
                        background: requirements.rooms.living_room > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${requirements.rooms.living_room > 0 ? '#10B981' : 'rgba(255,255,255,0.15)'}`,
                        color: requirements.rooms.living_room > 0 ? '#10B981' : 'rgba(255,255,255,0.4)',
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontFamily: 'DM Mono',
                        cursor: 'pointer',
                      }}
                    >
                      {requirements.rooms.living_room > 0 ? '✓ INCLUDED' : 'OMIT'}
                    </button>
                  </div>

                  {/* DINING ROOM TOGGLE */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#f5f5f2' }}>Dining Space</span>
                    <button
                      onClick={() =>
                        setRequirements({
                          ...requirements,
                          rooms: { ...requirements.rooms, dining_room: requirements.rooms.dining_room > 0 ? 0 : 1 },
                        })
                      }
                      style={{
                        background: requirements.rooms.dining_room > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${requirements.rooms.dining_room > 0 ? '#10B981' : 'rgba(255,255,255,0.15)'}`,
                        color: requirements.rooms.dining_room > 0 ? '#10B981' : 'rgba(255,255,255,0.4)',
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontFamily: 'DM Mono',
                        cursor: 'pointer',
                      }}
                    >
                      {requirements.rooms.dining_room > 0 ? '✓ INCLUDED' : 'OMIT'}
                    </button>
                  </div>

                  {/* PARKING TOGGLE */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#f5f5f2' }}>Car Parking / Porch</span>
                    <button
                      onClick={() =>
                        setRequirements({
                          ...requirements,
                          rooms: { ...requirements.rooms, parking: requirements.rooms.parking > 0 ? 0 : 1 },
                        })
                      }
                      style={{
                        background: requirements.rooms.parking > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${requirements.rooms.parking > 0 ? '#10B981' : 'rgba(255,255,255,0.15)'}`,
                        color: requirements.rooms.parking > 0 ? '#10B981' : 'rgba(255,255,255,0.4)',
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontFamily: 'DM Mono',
                        cursor: 'pointer',
                      }}
                    >
                      {requirements.rooms.parking > 0 ? '✓ INCLUDED' : 'OMIT'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. COMPILED PROMPT SUMMARY */}
              <div
                style={{
                  background: 'rgba(3, 5, 6, 0.6)',
                  border: '1px dashed rgba(125, 231, 255, 0.25)',
                  borderRadius: '4px',
                  padding: '12px',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontSize: '8px', fontFamily: 'DM Mono', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>
                  TARGET MODEL PROMPT:
                </span>
                <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#7de7ff', lineHeight: '1.4' }}>
                  "{compilePromptFromRequirements(requirements)}"
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <button
                className="technical-btn"
                onClick={handleExecuteGeneration}
                style={{
                  width: '100%',
                  background: '#7de7ff',
                  color: '#030506',
                  fontWeight: '800',
                  border: 'none',
                  padding: '14px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 20px rgba(125, 231, 255, 0.3)',
                  marginBottom: '10px',
                }}
              >
                <Sparkles size={16} />
                GENERATE FLOOR PLAN
              </button>

              <button
                className="technical-btn"
                onClick={() => setWorkflowStep('chat')}
                style={{ width: '100%', padding: '10px', fontSize: '10px' }}
              >
                ← BACK TO PROMPT & CHAT
              </button>
            </div>
          </aside>
        )}

        {/* =========================================================================
            STAGE 3: GENERATED FLOOR PLAN SIDEBAR (PARAMETERS & RECONFIGURATION)
            ========================================================================= */}
        {workflowStep === 'generated' && (
          <aside className="generate-sidebar" style={{ width: '380px', overflowY: 'auto' }}>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h2 className="sidebar-title" style={{ fontSize: '12px' }}>CONFIGURED PARAMETERS</h2>
                <span
                  style={{
                    fontSize: '8px',
                    fontFamily: 'DM Mono',
                    color: '#7de7ff',
                    border: '1px solid #7de7ff',
                    padding: '2px 6px',
                    borderRadius: '2px',
                  }}
                >
                  T5 // 11 RULES
                </span>
              </div>

              <div className="divider-line" style={{ margin: '15px 0' }} />

              <div className="sidebar-data-group">
                <div className="sidebar-data-item">
                  <label>PLOT / ENVELOPE</label>
                  <span>
                    {planResult?.layout?.plot?.width || requirements?.plot.width || 30} ×{' '}
                    {planResult?.layout?.plot?.length || requirements?.plot.length || 40} FT (
                    {(
                      (planResult?.layout?.plot?.width || requirements?.plot.width || 30) *
                      (planResult?.layout?.plot?.length || requirements?.plot.length || 40)
                    ).toLocaleString()}{' '}
                    SQ.FT.)
                  </span>
                </div>

                <div className="sidebar-data-item">
                  <label>ROOM PROGRAM</label>
                  <span>
                    {planResult?.layout?.rooms?.filter((r) => r.type === 'bedroom').length || requirements?.rooms.bedrooms || 2} BED ·{' '}
                    {planResult?.layout?.rooms?.filter((r) => r.type === 'bathroom').length || requirements?.rooms.bathrooms || 2} BATH ·{' '}
                    {planResult?.layout?.rooms?.some((r) => r.type === 'parking') ? 'PARKING' : 'NO PKG'}
                  </span>
                </div>

                <div className="sidebar-data-item">
                  <label>ACTIVE PROMPT</label>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', textTransform: 'none', wordBreak: 'break-word' }}>
                    "{planResult?.prompt || (requirements ? compilePromptFromRequirements(requirements) : '')}"
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="technical-btn"
                  onClick={handleExecuteGeneration}
                  disabled={loading}
                  style={{
                    width: '100%',
                    background: loading ? 'rgba(125, 231, 255, 0.1)' : '#7de7ff',
                    color: loading ? '#7de7ff' : '#030506',
                    fontWeight: '800',
                    border: 'none',
                    padding: '12px',
                  }}
                >
                  {loading ? 'RE-SYNTHESIZING...' : 'REGENERATE PLAN'}
                </button>

                <button
                  className="technical-btn"
                  onClick={() => setWorkflowStep('confirm')}
                  style={{ width: '100%', padding: '10px', fontSize: '10px' }}
                >
                  EDIT REQUIREMENTS
                </button>

                <button
                  className="technical-btn"
                  onClick={handleResetAll}
                  style={{ width: '100%', padding: '10px', fontSize: '10px' }}
                >
                  START NEW PLAN
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* =========================================================================
            RIGHT MAIN WORKSPACE: ARCHITECTURAL BLUEPRINT CANVAS & VERIFICATION HUD
            ========================================================================= */}
        <main className="generate-workspace">
          <header className="workspace-header">
            <div>
              <span className="input-label" style={{ display: 'block', marginBottom: '4px', color: '#7de7ff' }}>
                {workflowStep === 'generated'
                  ? 'SPATIAL AI OUTPUT // T5-SMALL CONSTRAINT VERIFIED'
                  : 'PLANORA SPATIAL WORKSPACE'}
              </span>
              <h1>{workflowStep === 'generated' ? 'GENERATED FLOOR PLAN' : 'ARCHITECTURAL DESIGN BLUEPRINT'}</h1>
            </div>

            {workflowStep === 'generated' && (
              <div className="workspace-actions">
                <button className="technical-btn" onClick={() => setWorkflowStep('confirm')}>
                  EDIT PLAN
                </button>
                <button className="technical-btn" onClick={handleExecuteGeneration}>
                  REGENERATE
                </button>
                <button className="technical-btn" onClick={handleDownloadSVG} disabled={!planResult?.svg}>
                  EXPORT SVG
                </button>
                <button
                  className="technical-btn"
                  style={{ borderColor: '#7de7ff', color: '#7de7ff' }}
                  onClick={() => setShow3DModal(true)}
                >
                  RENDER 3D VIEW
                </button>
              </div>
            )}
          </header>

          {/* ERROR ALERT IF ANY */}
          {errorMessage && (
            <div
              style={{
                border: '1px solid #EF4444',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '16px',
                borderRadius: '4px',
                color: '#FCA5A5',
                fontFamily: 'DM Mono',
                fontSize: '11px',
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* MAIN BLUEPRINT CANVAS */}
          <section className="workspace-canvas" style={{ minHeight: '620px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div className="canvas-blueprint-grid" />

            {/* ZOOM CONTROLS */}
            {planResult?.svg && !loading && (
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  display: 'flex',
                  gap: '6px',
                  zIndex: 10,
                  background: 'rgba(10, 14, 23, 0.85)',
                  padding: '6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <button
                  className="technical-btn"
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                  onClick={() => setSvgZoom((z) => Math.max(0.6, z - 0.1))}
                >
                  -
                </button>
                <span style={{ fontSize: '9px', fontFamily: 'DM Mono', display: 'flex', alignItems: 'center', padding: '0 4px', color: '#7de7ff' }}>
                  {Math.round(svgZoom * 100)}%
                </span>
                <button
                  className="technical-btn"
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                  onClick={() => setSvgZoom((z) => Math.min(1.8, z + 0.1))}
                >
                  +
                </button>
                <button className="technical-btn" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={() => setSvgZoom(1)}>
                  FIT
                </button>
              </div>
            )}

            {/* LOADING STATE */}
            {loading && (
              <div className="canvas-center-model" style={{ zIndex: 5 }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(125, 231, 255, 0.2)',
                    borderTopColor: '#7de7ff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 20px auto',
                  }}
                />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#7de7ff', letterSpacing: '0.15em', marginBottom: '8px' }}>
                  NEURAL SPATIAL SYNTHESIS IN PROGRESS
                </div>
                <h3>SOLVING FLOOR PLAN GEOMETRY</h3>
                <p>Generating room coordinates, verifying boundaries, and calculating door circulation...</p>
              </div>
            )}

            {/* RENDERED SVG FLOOR PLAN */}
            {!loading && planResult?.svg && workflowStep === 'generated' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  transform: `scale(${svgZoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease',
                  overflow: 'visible',
                  zIndex: 2,
                }}
                dangerouslySetInnerHTML={{ __html: planResult.svg }}
              />
            )}

            {/* INITIAL EMPTY / INTERACTIVE CANVAS STATE */}
            {(!planResult || workflowStep !== 'generated') && !loading && (
              <div className="canvas-center-model" style={{ zIndex: 2, maxWidth: '520px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    background: 'rgba(125, 231, 255, 0.08)',
                    border: '1px solid rgba(125, 231, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <Building size={24} color="#7de7ff" />
                </div>
                <div style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#7de7ff', marginBottom: '10px' }}>
                  ● WORKSPACE READY // NO AUTOMATIC PLAN
                </div>
                <h3>PLANORA SPATIAL ENGINE</h3>
                <p style={{ lineHeight: '1.6', color: 'rgba(255,255,255,0.6)' }}>
                  {workflowStep === 'chat'
                    ? 'Enter your requirements on the left panel (e.g. "I want a 30x40 house with 2 bedrooms and 2 bathrooms") to start conversational planning.'
                    : 'Review and confirm your parameters on the left panel, then click "Generate Floor Plan" to synthesize your blueprint.'}
                </p>

                {requirements && workflowStep === 'chat' && (
                  <button
                    className="technical-btn"
                    onClick={handleProceedToConfirm}
                    style={{
                      marginTop: '20px',
                      background: '#7de7ff',
                      color: '#030506',
                      fontWeight: '800',
                      border: 'none',
                      padding: '12px 24px',
                    }}
                  >
                    PROCEED TO CONFIRMATION →
                  </button>
                )}
              </div>
            )}
          </section>

          {/* LOWER HUD: ROOM PROGRAM CHECKLIST & CONSTRAINT STATUS (ONLY IN GENERATED STEP) */}
          {planResult && workflowStep === 'generated' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '20px' }}>
              {/* 1. ROOM PROGRAM CHECKLIST */}
              <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.015)', borderRadius: '4px', padding: '18px' }}>
                <div className="input-label" style={{ fontSize: '8px', color: '#7de7ff', marginBottom: '10px' }}>
                  PROGRAM ALLOCATION
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {planResult.layout?.rooms?.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'DM Mono' }}>
                      <span style={{ color: '#f5f5f2' }}>
                        <span style={{ color: '#10B981', marginRight: '6px' }}>✓</span>
                        {r.name}
                      </span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                        {r.width}' × {r.height}' ({Math.round(r.width * r.height)} sq.ft)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. CONSTRAINT STATUS */}
              <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.015)', borderRadius: '4px', padding: '18px' }}>
                <div className="input-label" style={{ fontSize: '8px', color: '#7de7ff', marginBottom: '10px' }}>
                  CONSTRAINT STATUS
                </div>

                {planResult.validation.valid ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontSize: '12px', fontWeight: '700', fontFamily: 'DM Mono' }}>
                      <span style={{ fontSize: '16px' }}>✓</span> VALID CODE-COMPLIANT LAYOUT
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '6px', lineHeight: '1.5' }}>
                      {planResult.was_repaired
                        ? 'Zero overlaps. Plot perimeter bounded. Adjusted and verified by constraint repair engine.'
                        : 'Zero overlaps. All rooms within plot boundary and satisfy architectural dimensions.'}
                    </div>
                    {planResult.validation.warnings?.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '9px', color: '#F59E0B', fontFamily: 'DM Mono' }}>
                        Note: {planResult.validation.warnings[0]}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontSize: '12px', fontWeight: '700', fontFamily: 'DM Mono' }}>
                      <span>⚠️</span> VALIDATION ISSUES DETECTED
                    </div>
                    <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '10px', color: '#FCA5A5', lineHeight: '1.5' }}>
                      {planResult.validation.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 3. METRICS CARD */}
              <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.015)', borderRadius: '4px', padding: '18px' }}>
                <div className="input-label" style={{ fontSize: '8px', color: '#7de7ff', marginBottom: '10px' }}>
                  BLUEPRINT METRICS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '7px', fontFamily: 'DM Mono', color: 'rgba(255,255,255,0.4)' }}>TOTAL PLOT</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#7de7ff', marginTop: '2px' }}>
                      {(planResult.layout?.plot?.width || 30) * (planResult.layout?.plot?.length || 40)}
                      <span style={{ fontSize: '9px', fontWeight: '400', marginLeft: '2px' }}>sq.ft</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '7px', fontFamily: 'DM Mono', color: 'rgba(255,255,255,0.4)' }}>TOTAL BUILT</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#f5f5f2', marginTop: '2px' }}>
                      {Math.round(planResult.layout?.rooms?.reduce((acc, r) => acc + r.width * r.height, 0) || 0)}
                      <span style={{ fontSize: '9px', fontWeight: '400', marginLeft: '2px' }}>sq.ft</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '7px', fontFamily: 'DM Mono', color: 'rgba(255,255,255,0.4)' }}>DOORS</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#f5f5f2', marginTop: '2px' }}>
                      {planResult.layout?.doors?.length || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '7px', fontFamily: 'DM Mono', color: 'rgba(255,255,255,0.4)' }}>WINDOWS</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#f5f5f2', marginTop: '2px' }}>
                      {planResult.layout?.windows?.length || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* THREE.JS 3D SCENE SPECIFICATION MODAL */}
      {show3DModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 5, 6, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShow3DModal(false)}
        >
          <div
            style={{
              width: '700px',
              maxWidth: '90vw',
              background: '#0B111E',
              border: '1px solid rgba(125, 231, 255, 0.3)',
              borderRadius: '8px',
              padding: '30px',
              boxShadow: '0 0 40px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                <span style={{ fontSize: '9px', fontFamily: 'DM Mono', color: '#7de7ff' }}>PHASE 10 // THREE.JS COMPATIBILITY</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: '800' }}>STRUCTURED 3D COORDINATE PAYLOAD</h3>
              </div>
              <button className="technical-btn" onClick={() => setShow3DModal(false)}>
                CLOSE
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5', margin: '0 0 15px 0' }}>
              This validated layout JSON is formatted for direct ingestion by Three.js primitives (walls, floor meshes, door openings, and furniture).
            </p>
            <pre
              style={{
                background: '#05080E',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '16px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'DM Mono, monospace',
                color: '#7de7ff',
                maxHeight: '320px',
                overflowY: 'auto',
              }}
            >
              {JSON.stringify(
                {
                  scene: {
                    plot: planResult?.layout?.plot,
                    rooms: planResult?.layout?.rooms,
                    doors: planResult?.layout?.doors,
                    windows: planResult?.layout?.windows,
                    wall_height: 10.0,
                    wall_thickness: 0.5,
                  },
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default Generate
