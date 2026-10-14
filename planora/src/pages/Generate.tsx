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
import FloorPlan3DViewer from '../components/FloorPlan3DViewer'


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
    plot: { width: number; length: number; height: number; unit: string; floors?: number }
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
  confirmation_summary?: string
}

interface StructuredRequirements {
  plot: { width: number; length: number; height: number; unit: string; floors: number }
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

function parseWordNumber(str: string): number | null {
  const s = str.toLowerCase().trim()
  const map: Record<string, number> = {
    zero: 0,
    one: 1,
    single: 1,
    two: 2,
    double: 2,
    three: 3,
    triple: 3,
    four: 4,
    five: 5,
    six: 6,
  }
  if (map[s] !== undefined) return map[s]
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function formatFinalSummary(req: StructuredRequirements): string {
  const parts: string[] = [
    `${req.plot.width}×${req.plot.length} FT plot`,
    `${req.rooms.bedrooms} bedroom${req.rooms.bedrooms !== 1 ? 's' : ''}`,
    `${req.rooms.bathrooms} bathroom${req.rooms.bathrooms !== 1 ? 's' : ''}`,
    `${req.rooms.kitchen} kitchen`,
    `${req.rooms.living_room} living room`,
  ]
  if (req.rooms.dining_room > 0) parts.push(`${req.rooms.dining_room} dining room`)
  parts.push(req.rooms.balcony > 0 ? 'balcony included' : 'balcony excluded')
  parts.push(req.rooms.parking > 0 ? 'parking included' : 'parking excluded')
  return parts.join(', ')
}

function parseInitialRequirements(text: string): StructuredRequirements {
  const clean = text.toLowerCase()
  let width = 30
  let length = 40

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

  // Floors
  let floors = 1
  const floorMatch = clean.match(/(\d+|single|double|two|three)\s*(?:floor|floors|storey|story)/i)
  if (floorMatch) {
    const fn = parseWordNumber(floorMatch[1])
    if (fn) floors = fn
  }

  // Bedrooms
  let bedrooms = 2
  const bedCountMatch = clean.match(/(\d+|one|single|two|three|four|five)\s*(?:bhk|bed|beds|bedroom|bedrooms)/i)
  if (bedCountMatch) {
    const parsed = parseWordNumber(bedCountCountOrFallback(bedCountMatch[1]))
    if (parsed !== null) bedrooms = parsed
  } else if (clean.includes('1 bedroom') || clean.includes('1 bed') || clean.includes('1bhk')) {
    bedrooms = 1
  }

  // Bathrooms
  let bathrooms = 2
  const isOneBath =
    clean.includes('1 bathroom') ||
    clean.includes('1 bath') ||
    clean.includes('single bathroom') ||
    clean.includes('one bathroom') ||
    clean.includes('1 toilet') ||
    clean.includes('1 washroom')
  if (isOneBath) {
    bathrooms = 1
  } else {
    const bathCountMatch = clean.match(/(\d+|one|single|two|three|four)\s*(?:bath|baths|bathroom|bathrooms|toilet|toilets|washroom)/i)
    if (bathCountMatch) {
      const parsed = parseWordNumber(bathCountMatch[1])
      if (parsed !== null) bathrooms = parsed
    }
  }

  // Kitchen
  let kitchen = 1
  if (clean.includes('no kitchen') || clean.includes('without kitchen')) kitchen = 0

  // Living Room
  let living_room = 1
  if (clean.includes('no living') || clean.includes('without living')) living_room = 0

  // Dining
  let dining_room = 0
  if ((clean.includes('dining') || clean.includes('dining room')) && !clean.includes('no dining') && !clean.includes('without dining')) {
    dining_room = 1
  }

  // Parking
  let parking = 0
  if ((clean.includes('parking') || clean.includes('garage') || clean.includes('car porch')) &&
      !clean.includes('no parking') && !clean.includes('without parking') && !clean.includes('no pkg') && !clean.includes('remove parking')) {
    parking = 1
  }

  // Balcony
  let balcony = 0
  if ((clean.includes('balcony') || clean.includes('terrace')) &&
      !clean.includes('no balcony') && !clean.includes('without balcony') && !clean.includes('remove balcony')) {
    balcony = 1
  }

  return {
    plot: { width, length, height: 10, unit: 'ft', floors },
    rooms: {
      bedrooms,
      bathrooms,
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

function bedCountCountOrFallback(val: string): string {
  return val
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
    return `${req.plot.width}x${req.plot.length} ft house with 2 bedrooms, 1 bathroom, 1 kitchen, 1 living room`
  }

  if (roomParts.length === 1) return `${parts[0]} ${roomParts[0]}`
  const last = roomParts.pop()
  return `${parts[0]} ${roomParts.join(', ')} and ${last}`
}

function processConversationalInput(
  userText: string,
  currentReq: StructuredRequirements | null,
  decidedTopics: string[]
): {
  updatedRequirements: StructuredRequirements
  aiReply: string
  suggestions: string[]
  isCompletion: boolean
  newDecidedTopics: string[]
} {
  const clean = userText.toLowerCase().trim()
  const decidedSet = new Set(decidedTopics)

  // 1. Meta-Question / Customization inquiry
  const isMetaQuery =
    /^(?:can|could|is it possible to|how do i)\s+(?:i\s+)?(?:exclude|remove|omit|change|modify|add|customise|customize)/i.test(clean) ||
    (/(?:exclude|remove|omit)\s+(?:anything|something|any room)/i.test(clean) && clean.includes('?')) ||
    clean === 'can i exclude something?' ||
    clean === 'can i exclude something' ||
    clean === 'can i remove something?' ||
    clean === 'can i remove something'

  if (isMetaQuery) {
    const baseReq = currentReq || {
      plot: { width: 30, length: 40, height: 10, unit: 'ft', floors: 1 },
      rooms: { bedrooms: 2, bathrooms: 2, kitchen: 1, living_room: 1, dining_room: 0, parking: 0, balcony: 0, utility: 0, study_room: 0 }
    }
    return {
      updatedRequirements: baseReq,
      aiReply: "Yes, absolutely! You can add, remove, or modify any architectural requirement at any point—such as saying 'remove parking', 'make it 1 bathroom', 'add balcony', 'I don't want a dining room', or changing plot dimensions. What would you like to adjust?",
      suggestions: ['Remove Parking', 'Make it 1 Bathroom', 'Include Balcony', 'Keep Everything'],
      isCompletion: false,
      newDecidedTopics: decidedTopics,
    }
  }

  // 2. Completion triggers
  const isCompletion =
    /^(?:done|that'?s all|thats all|generate(?: it)?|generate the plan|create plan|make plan|looks good|ready|proceed|let'?s generate|lets generate)\.?$/i.test(clean) ||
    /\b(?:done|that'?s all|generate it)\b/i.test(clean)

  if (isCompletion) {
    const finalReq = currentReq || parseInitialRequirements('30x40 ft house with 2 bedrooms and 2 bathrooms')
    const w = finalReq.plot.width
    const l = finalReq.plot.length
    const bed = finalReq.rooms.bedrooms
    const bath = finalReq.rooms.bathrooms
    const kit = finalReq.rooms.kitchen
    const liv = finalReq.rooms.living_room
    const balc = finalReq.rooms.balcony > 0
    const park = finalReq.rooms.parking > 0
    const din = finalReq.rooms.dining_room > 0

    const reply = `Understood. Here is your final validated architectural program:\n\n• Plot: ${w}×${l} FT (${w * l} sq.ft)\n• Program: ${bed} Bed, ${bath} Bath, ${kit} Kitchen, ${liv} Living\n• Amenities: ${balc ? 'Balcony included' : 'Balcony excluded'}, ${park ? 'Parking included' : 'Parking excluded'}${din ? ', Dining included' : ''}\n\nAll constraints and space allocations are validated. Click 'Generate Floor Plan' below to synthesize your blueprint.`

    return {
      updatedRequirements: finalReq,
      aiReply: reply,
      suggestions: ['⚡ Generate Floor Plan', 'Review Parameters'],
      isCompletion: true,
      newDecidedTopics: decidedTopics,
    }
  }

  // 3. "Keep everything else the same"
  const isKeepSame =
    /(?:keep everything|keep the rest|keep remaining|leave everything|no other change|nothing else|same as is|keep it as is)/i.test(clean)

  if (isKeepSame && currentReq) {
    return {
      updatedRequirements: currentReq,
      aiReply: `Noted. Keeping all remaining parameters locked: ${formatFinalSummary(currentReq)}. Ready to generate whenever you like!`,
      suggestions: ['Done, Generate Plan', 'Review Parameters'],
      isCompletion: false,
      newDecidedTopics: decidedTopics,
    }
  }

  // 4. Initial request or incremental modification
  const updated: StructuredRequirements = currentReq
    ? JSON.parse(JSON.stringify(currentReq))
    : parseInitialRequirements(userText)

  const changes: string[] = []

  if (!currentReq) {
    // Brand new state
    if (clean.includes('bhk') || clean.includes('bed')) decidedSet.add('bedrooms')
    if (clean.includes('bath') || clean.includes('toilet')) decidedSet.add('bathrooms')
    if (clean.includes('parking') || clean.includes('garage')) decidedSet.add('parking')
    if (clean.includes('balcony') || clean.includes('terrace')) decidedSet.add('balcony')
    if (clean.includes('dining')) decidedSet.add('dining')
    if (clean.match(/\d+\s*(?:x|by|\*)\s*\d+/i)) decidedSet.add('plot')
  } else {
    // Incremental modifications: Never revert unchanged fields!

    // A. Plot dimensions
    const dimMatch = clean.match(/(\d+)\s*(?:x|by|\*)\s*(\d+)/i)
    if (dimMatch) {
      const w = parseInt(dimMatch[1], 10)
      const l = parseInt(dimMatch[2], 10)
      if (w !== updated.plot.width || l !== updated.plot.length) {
        updated.plot.width = w
        updated.plot.length = l
        changes.push(`plot size updated to ${w}×${l} FT`)
        decidedSet.add('plot')
      }
    }

    // Floors
    const floorM = clean.match(/(\d+|single|double|two|three)\s*(?:floor|floors|storey|story)/i)
    if (floorM) {
      const fn = parseWordNumber(floorM[1])
      if (fn && fn !== updated.plot.floors) {
        updated.plot.floors = fn
        changes.push(`floors set to ${fn}`)
        decidedSet.add('floors')
      }
    }

    // B. Bathrooms
    if (/(?:no|without|remove|zero|0)\s+(?:the\s+)?(?:bath|baths|bathroom|bathrooms|toilet|washroom)/i.test(clean)) {
      if (updated.rooms.bathrooms !== 0) {
        updated.rooms.bathrooms = 0
        changes.push('bathrooms removed')
      }
      decidedSet.add('bathrooms')
    } else {
      const bathCountMatch = clean.match(/(?:make it|change (?:it )?to|set (?:it )?to|i want|want|need|have)?\s*(\d+|one|single|two|three|four)\s*(?:bath|baths|bathroom|bathrooms|toilet|toilets|washroom)(?:\s+(?:only|instead))?/i)
      if (bathCountMatch) {
        const cnt = parseWordNumber(bathCountMatch[1])
        if (cnt !== null) {
          if (updated.rooms.bathrooms !== cnt) {
            changes.push(`adjusted to ${cnt} bathroom${cnt !== 1 ? 's' : ''}`)
          }
          updated.rooms.bathrooms = cnt
          decidedSet.add('bathrooms')
        }
      }
    }

    // C. Bedrooms
    if (/(?:no|without|remove)\s+(?:the\s+)?(?:bed|beds|bedroom|bedrooms)/i.test(clean)) {
      if (updated.rooms.bedrooms !== 0) {
        updated.rooms.bedrooms = 0
        changes.push('bedrooms removed')
      }
      decidedSet.add('bedrooms')
    } else {
      const bedCountMatch = clean.match(/(?:make it|change (?:it )?to|set (?:it )?to|i want|want|need|have)?\s*(\d+|one|single|two|three|four|five)\s*(?:bhk|bed|beds|bedroom|bedrooms)(?:\s+(?:only|instead))?/i)
      if (bedCountMatch) {
        const cnt = parseWordNumber(bedCountMatch[1])
        if (cnt !== null) {
          if (updated.rooms.bedrooms !== cnt) {
            changes.push(`adjusted to ${cnt} bedroom${cnt !== 1 ? 's' : ''}`)
          }
          updated.rooms.bedrooms = cnt
          decidedSet.add('bedrooms')
        }
      }
    }

    // D. Parking
    if (/(?:remove|no|without|don't want|do not want|exclude|omit|drop|cancel)\s+(?:the\s+)?(?:car\s+)?(?:parking|garage|car porch|porch)/i.test(clean) ||
        /(?:parking|garage)\s+(?:excluded|omitted|removed|not needed|not required|off)/i.test(clean) ||
        clean === 'no parking') {
      if (updated.rooms.parking !== 0) {
        changes.push('parking excluded')
      }
      updated.rooms.parking = 0
      decidedSet.add('parking')
    } else if (/(?:add|include|included|with|plus|want)\s+(?:a\s+|an\s+)?(?:car\s+)?(?:parking|garage|porch)/i.test(clean) ||
               /(?:parking|garage)\s+(?:included|added|wanted|on|yes)/i.test(clean)) {
      if (updated.rooms.parking !== 1) {
        changes.push('parking included')
      }
      updated.rooms.parking = 1
      decidedSet.add('parking')
    }

    // E. Balcony
    if (/(?:remove|no|without|don't want|do not want|exclude|omit|drop|cancel)\s+(?:the\s+)?(?:balcony|balconies|terrace)/i.test(clean) ||
        /(?:balcony|terrace)\s+(?:excluded|omitted|removed|not needed|not required|off)/i.test(clean) ||
        clean === 'no balcony') {
      if (updated.rooms.balcony !== 0) {
        changes.push('balcony removed')
      }
      updated.rooms.balcony = 0
      decidedSet.add('balcony')
    } else if (/(?:add|include|included|with|plus|want)\s+(?:a\s+|an\s+)?(?:balcony|balconies|terrace)/i.test(clean) ||
               /(?:balcony|terrace)\s+(?:included|added|wanted|on|yes)/i.test(clean) ||
               clean === 'included balcony' || clean === 'include balcony') {
      if (updated.rooms.balcony !== 1) {
        changes.push('balcony included')
      }
      updated.rooms.balcony = 1
      decidedSet.add('balcony')
    }

    // F. Dining Room
    if (/(?:remove|no|without|don't want|do not want|exclude|omit|drop)\s+(?:the\s+)?(?:dining|dining room|dining space)/i.test(clean) ||
        /(?:dining|dining room)\s+(?:excluded|omitted|removed|not needed|not required)/i.test(clean) ||
        clean === 'no dining' || clean === "i don't want a dining room") {
      if (updated.rooms.dining_room !== 0) {
        changes.push('dining room excluded')
      }
      updated.rooms.dining_room = 0
      decidedSet.add('dining')
    } else if (/(?:add|include|included|with|plus|want)\s+(?:a\s+|an\s+)?(?:dining|dining room|dining space)/i.test(clean) ||
               /(?:dining|dining room)\s+(?:included|added|wanted)/i.test(clean)) {
      if (updated.rooms.dining_room !== 1) {
        changes.push('dining room included')
      }
      updated.rooms.dining_room = 1
      decidedSet.add('dining')
    }

    // G. Kitchen & Living
    if (/(?:remove|no|without|don't want)\s+(?:the\s+)?kitchen/i.test(clean)) {
      updated.rooms.kitchen = 0
      changes.push('kitchen removed')
      decidedSet.add('kitchen')
    }
    if (/(?:remove|no|without|don't want)\s+(?:the\s+)?(?:living|hall)/i.test(clean)) {
      updated.rooms.living_room = 0
      changes.push('living room removed')
      decidedSet.add('living')
    }
  }

  // Assemble natural architectural reply
  let aiReply = ''
  if (!currentReq) {
    aiReply = `I have recorded a ${updated.plot.width}×${updated.plot.length} FT plot with ${updated.rooms.bedrooms} bedroom${updated.rooms.bedrooms !== 1 ? 's' : ''}, ${updated.rooms.bathrooms} bathroom${updated.rooms.bathrooms !== 1 ? 's' : ''}, ${updated.rooms.kitchen} kitchen, and ${updated.rooms.living_room} living room.`
  } else if (changes.length > 0) {
    aiReply = `Updated: ${changes.join(', ')}. Current state: ${formatFinalSummary(updated)}.`
  } else {
    aiReply = `Understood. Current configuration: ${formatFinalSummary(updated)}.`
  }

  // Context-aware follow-up question (never repeat decided topics!)
  const suggestions: string[] = []
  if (!decidedSet.has('parking')) {
    aiReply += ' Would you like to include car parking, or keep it excluded?'
    suggestions.push('+ Add Parking', 'Exclude Parking')
  } else if (!decidedSet.has('balcony')) {
    aiReply += ' Would you like to include an exterior balcony or terrace?'
    suggestions.push('+ Add Balcony', 'No Balcony')
  } else if (!decidedSet.has('dining') && updated.rooms.dining_room === 0) {
    aiReply += ' Would you like a dedicated dining space or an integrated layout?'
    suggestions.push('+ Add Dining Room', 'No Dining')
  } else {
    aiReply += " All specifications are balanced and confirmed. Say 'done' or click below whenever you'd like to synthesize your blueprint."
    suggestions.push('Done, Generate Plan', 'Review Parameters')
  }

  return {
    updatedRequirements: updated,
    aiReply,
    suggestions,
    isCompletion: false,
    newDecidedTopics: Array.from(decidedSet),
  }
}

const Generate: React.FC = () => {
  const navigate = useNavigate()

  // Workflow Step: 'chat' (Prompt/AI conversation) -> 'confirm' (Here's what I understood) -> 'generated' (2D Floor Plan)
  const [workflowStep, setWorkflowStep] = useState<'chat' | 'confirm' | 'generated'>('chat')

  // Inputs & Chat State (Initially completely empty)
  const [prompt, setPrompt] = useState<string>('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [requirements, setRequirements] = useState<StructuredRequirements | null>(null)
  const [decidedTopics, setDecidedTopics] = useState<string[]>([])

  // Plan generation state
  const [loading, setLoading] = useState<boolean>(false)
  const [planResult, setPlanResult] = useState<PlanGenerationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [svgZoom, setSvgZoom] = useState<number>(1)
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  // Handle user submitting text into the prompt/AI conversation
  const handleSendPrompt = (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : prompt
    if (!rawText.trim()) return

    const userText = rawText.trim()
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const {
      updatedRequirements,
      aiReply,
      suggestions,
      newDecidedTopics,
    } = processConversationalInput(userText, requirements, decidedTopics)

    // User message
    const newMessages: ChatMessage[] = [
      ...chatMessages,
      {
        id: Math.random().toString(),
        sender: 'user',
        text: userText,
        timestamp: now,
      },
      {
        id: Math.random().toString(),
        sender: 'ai',
        text: aiReply,
        timestamp: now,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      },
    ]

    setRequirements(updatedRequirements)
    setDecidedTopics(newDecidedTopics)
    setChatMessages(newMessages)
    setPrompt('')
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // Quick suggestion click
  const handleSelectSuggestion = (suggestion: string) => {
    if (suggestion === 'Done, Generate Plan' || suggestion === '⚡ Generate Floor Plan') {
      if (requirements) {
        handleExecuteGeneration()
      } else {
        handleProceedToConfirm()
      }
      return
    }

    if (suggestion === 'Review Parameters' || suggestion === 'Edit Requirements') {
      handleProceedToConfirm()
      return
    }

    if (suggestion === 'Keep Everything') {
      handleSendPrompt('keep everything else the same')
      return
    }

    if (suggestion === 'Exclude Parking' || suggestion === 'Remove Parking') {
      handleSendPrompt('remove parking')
      return
    }

    if (suggestion === 'No Balcony') {
      handleSendPrompt('no balcony')
      return
    }

    if (suggestion === 'Make it 1 Bathroom') {
      handleSendPrompt('make it 1 bathroom')
      return
    }

    if (suggestion.startsWith('+ Add ')) {
      const item = suggestion.replace('+ Add ', '').toLowerCase()
      handleSendPrompt(`add ${item}`)
      return
    }

    handleSendPrompt(suggestion)
  }

  // Transition from Chat to Confirmation screen
  const handleProceedToConfirm = () => {
    if (!requirements) {
      const def = parseInitialRequirements(prompt || '30x40 ft house with 2 bedrooms and 2 bathrooms')
      setRequirements(def)
    }
    setWorkflowStep('confirm')
  }

  // Execute Generate Floor Plan API call
  const handleExecuteGeneration = async () => {
    const targetReq = requirements || parseInitialRequirements('30x40 ft house with 2 bedrooms and 2 bathrooms')
    if (!requirements) {
      setRequirements(targetReq)
    }

    const finalPrompt = compilePromptFromRequirements(targetReq)
    setLoading(true)
    setErrorMessage(null)
    setWorkflowStep('generated')
    setViewMode('2d')

    try {
      const response = await fetch(`${backendUrl}/generate-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: finalPrompt, requirements: targetReq }),
      })

      if (!response.ok) {
        const errDetail = await response.json().catch(() => ({}))
        throw new Error(errDetail.detail || `Server error (${response.status})`)
      }

      const data: PlanGenerationResult = await response.json()
      setPlanResult(data)

      const confirmationText = data.confirmation_summary || `Plan generated using your final requirements: ${formatFinalSummary(targetReq)}.`
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setChatMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'ai',
          text: `✓ ${confirmationText}`,
          timestamp: now,
        },
      ])
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
    setDecidedTopics([])
    setPlanResult(null)
    setErrorMessage(null)
    setViewMode('2d')
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
                      onClick={() => {
                        const updated = {
                          ...requirements,
                          rooms: { ...requirements.rooms, parking: requirements.rooms.parking > 0 ? 0 : 1 },
                        }
                        setRequirements(updated)
                        setDecidedTopics((prev) => Array.from(new Set([...prev, 'parking'])))
                      }}
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

                  {/* BALCONY TOGGLE */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#f5f5f2' }}>Balcony / Terrace</span>
                    <button
                      onClick={() => {
                        const updated = {
                          ...requirements,
                          rooms: { ...requirements.rooms, balcony: requirements.rooms.balcony > 0 ? 0 : 1 },
                        }
                        setRequirements(updated)
                        setDecidedTopics((prev) => Array.from(new Set([...prev, 'balcony'])))
                      }}
                      style={{
                        background: requirements.rooms.balcony > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${requirements.rooms.balcony > 0 ? '#10B981' : 'rgba(255,255,255,0.15)'}`,
                        color: requirements.rooms.balcony > 0 ? '#10B981' : 'rgba(255,255,255,0.4)',
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontFamily: 'DM Mono',
                        cursor: 'pointer',
                      }}
                    >
                      {requirements.rooms.balcony > 0 ? '✓ INCLUDED' : 'OMIT'}
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
                    {requirements?.plot.width || planResult?.layout?.plot?.width || 30} ×{' '}
                    {requirements?.plot.length || planResult?.layout?.plot?.length || 40} FT (
                    {(
                      (requirements?.plot.width || planResult?.layout?.plot?.width || 30) *
                      (requirements?.plot.length || planResult?.layout?.plot?.length || 40)
                    ).toLocaleString()}{' '}
                    SQ.FT.)
                  </span>
                </div>

                <div className="sidebar-data-item">
                  <label>ROOM PROGRAM</label>
                  <span>
                    {requirements ? requirements.rooms.bedrooms : (planResult?.layout?.rooms?.filter((r) => r.type === 'bedroom').length || 2)} BED ·{' '}
                    {requirements ? requirements.rooms.bathrooms : (planResult?.layout?.rooms?.filter((r) => r.type === 'bathroom').length || 1)} BATH ·{' '}
                    {requirements ? (requirements.rooms.parking > 0 ? 'PARKING' : 'NO PKG') : (planResult?.layout?.rooms?.some((r) => r.type === 'parking') ? 'PARKING' : 'NO PKG')}
                    {requirements?.rooms.balcony ? ' · BALCONY' : ''}
                    {requirements?.rooms.dining_room ? ' · DINING' : ''}
                  </span>
                </div>

                <div className="sidebar-data-item">
                  <label>ACTIVE PROMPT</label>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', textTransform: 'none', wordBreak: 'break-word' }}>
                    "{requirements ? compilePromptFromRequirements(requirements) : (planResult?.prompt || '')}"
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
                  ? viewMode === '3d'
                    ? 'INTERACTIVE THREE.JS 3D VIEW // REAL-TIME RENDERING'
                    : 'SPATIAL AI OUTPUT // T5-SMALL CONSTRAINT VERIFIED'
                  : 'PLANORA SPATIAL WORKSPACE'}
              </span>
              <h1>
                {workflowStep === 'generated'
                  ? viewMode === '3d'
                    ? '3D ARCHITECTURAL MODEL'
                    : 'GENERATED FLOOR PLAN'
                  : 'ARCHITECTURAL DESIGN BLUEPRINT'}
              </h1>
            </div>

            {workflowStep === 'generated' && (
              <div className="workspace-actions">
                {viewMode === '3d' ? (
                  <button
                    className="technical-btn"
                    style={{ borderColor: '#7de7ff', color: '#7de7ff', fontWeight: 700 }}
                    onClick={() => setViewMode('2d')}
                  >
                    ← BACK TO 2D
                  </button>
                ) : (
                  <>
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
                      style={{ borderColor: '#7de7ff', color: '#7de7ff', fontWeight: 700 }}
                      onClick={() => setViewMode('3d')}
                    >
                      RENDER 3D VIEW
                    </button>
                  </>
                )}
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
                marginBottom: '14px',
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* CONFIRMATION SUMMARY ALERT */}
          {planResult?.confirmation_summary && (
            <div
              style={{
                border: '1px solid rgba(16, 185, 129, 0.4)',
                background: 'rgba(16, 185, 129, 0.08)',
                padding: '12px 18px',
                borderRadius: '4px',
                color: '#6EE7B7',
                fontFamily: 'DM Mono',
                fontSize: '11px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                lineHeight: '1.5',
              }}
            >
              <span style={{ color: '#10B981', fontWeight: 'bold' }}>✓</span>
              <span>{planResult.confirmation_summary}</span>
            </div>
          )}

          {/* MAIN BLUEPRINT CANVAS */}
          <section className="workspace-canvas" style={{ minHeight: '620px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div className="canvas-blueprint-grid" />

            {/* ZOOM CONTROLS (ONLY IN 2D VIEW) */}
            {planResult?.svg && !loading && viewMode === '2d' && (
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

            {/* 3D INTERACTIVE THREE.JS VIEW */}
            {!loading && planResult?.layout && workflowStep === 'generated' && viewMode === '3d' && (
              <div style={{ width: '100%', height: '100%', flex: 1, position: 'relative', zIndex: 2 }}>
                <FloorPlan3DViewer
                  layout={planResult.layout}
                  onBackTo2D={() => setViewMode('2d')}
                />
              </div>
            )}

            {/* RENDERED 2D SVG FLOOR PLAN */}
            {!loading && planResult?.svg && workflowStep === 'generated' && viewMode === '2d' && (
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
    </div>
  )
}


export default Generate
