import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RotateCcw, Info } from 'lucide-react'

export interface RoomItem {
  name: string
  room: string
  type: string
  x: number
  y: number
  width: number
  height: number
}

export interface DoorItem {
  x: number
  y: number
  width?: number
  height?: number
  wall?: string
  room?: string
  room_a?: string
  room_b?: string
}

export interface WindowItem {
  x: number
  y: number
  width?: number
  height?: number
  wall?: string
  room?: string
}

export interface PlotData {
  width: number
  height: number
  length: number
  unit: string
}

export interface LayoutData {
  plot: PlotData
  rooms: RoomItem[]
  doors: DoorItem[]
  windows: WindowItem[]
}

interface FloorPlan3DViewerProps {
  layout: LayoutData
  onBackTo2D: () => void
}

/* =========================================================================
   ARCHITECTURAL COLOR PALETTE & FINISHES
   Warm white walls, natural oak wood flooring, soft neutral beige/grey fabrics,
   olive/emerald greenery, and subtle metallic touches.
   ========================================================================= */

const FLOOR_FINISHES: Record<string, { floorColor: number; roughness: number; accent: string; label: string }> = {
  bedroom: { floorColor: 0xd8c2a7, roughness: 0.65, accent: '#64748b', label: 'Bedroom' }, // Natural warm oak
  bathroom: { floorColor: 0xdde5b6, roughness: 0.35, accent: '#0284c7', label: 'Bathroom' }, // Matte limestone/tile
  toilet: { floorColor: 0xdde5b6, roughness: 0.35, accent: '#0284c7', label: 'Bathroom' },
  kitchen: { floorColor: 0xe0e1dd, roughness: 0.3, accent: '#ea580c', label: 'Kitchen' }, // Polished terrazzo
  living: { floorColor: 0xdecbb5, roughness: 0.6, accent: '#8b5cf6', label: 'Living Room' }, // Light Scandinavian oak
  living_room: { floorColor: 0xdecbb5, roughness: 0.6, accent: '#8b5cf6', label: 'Living Room' },
  dining: { floorColor: 0xd6c0a8, roughness: 0.6, accent: '#f59e0b', label: 'Dining' }, // Warm timber
  dining_room: { floorColor: 0xd6c0a8, roughness: 0.6, accent: '#f59e0b', label: 'Dining' },
  balcony: { floorColor: 0xa3b18a, roughness: 0.8, accent: '#10b981', label: 'Balcony' }, // Exterior decking/tile
  parking: { floorColor: 0x475569, roughness: 0.85, accent: '#94a3b8', label: 'Parking' }, // Honed concrete
  utility: { floorColor: 0xcfd2d6, roughness: 0.5, accent: '#6b7280', label: 'Utility' },
  study: { floorColor: 0xd3b89e, roughness: 0.6, accent: '#22c55e', label: 'Study' },
  default: { floorColor: 0xd4c2a8, roughness: 0.65, accent: '#7de7ff', label: 'Room' },
}

function getRoomFinish(roomKey: string) {
  const k = (roomKey || '').toLowerCase()
  for (const key of Object.keys(FLOOR_FINISHES)) {
    if (k.includes(key)) return FLOOR_FINISHES[key]
  }
  return FLOOR_FINISHES.default
}

/* =========================================================================
   COMPACT & SUBTLE ROOM LABELS
   Small, clean, professional architectural label badge hovering neatly.
   ========================================================================= */

function createSubtleRoomBadge(text: string, subText: string, accentColor: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 72
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Semi-translucent dark architectural pill
    ctx.fillStyle = 'rgba(10, 16, 26, 0.82)'
    ctx.beginPath()
    ctx.roundRect(4, 4, 248, 64, 12)
    ctx.fill()

    // Border
    ctx.lineWidth = 2
    ctx.strokeStyle = accentColor
    ctx.stroke()

    // Left indicator dot
    ctx.fillStyle = accentColor
    ctx.beginPath()
    ctx.arc(20, 36, 5, 0, Math.PI * 2)
    ctx.fill()

    // Clean typography
    ctx.fillStyle = '#f8fafc'
    ctx.font = 'bold 20px "Manrope", sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text.toUpperCase(), 34, 26)

    // Dimensions
    ctx.fillStyle = accentColor
    ctx.font = '500 14px "DM Mono", monospace'
    ctx.fillText(subText, 34, 48)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    opacity: 0.92,
  })
  const sprite = new THREE.Sprite(spriteMaterial)
  return sprite
}

/* =========================================================================
   PROCEDURAL ARCHITECTURAL MESH BUILDERS
   ========================================================================= */

interface MeshBoxParams {
  w: number
  h: number
  d: number
  x: number
  y: number
  z: number
  color: number
  roughness?: number
  metalness?: number
}

function makeBoxMesh({ w, h, d, x, y, z, color, roughness = 0.65, metalness = 0.1 }: MeshBoxParams): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Builds tasteful Potted Plants (ceramic pot + foliage sphere/cylinder)
 */
function buildPlant(x: number, z: number, group: THREE.Group, scale = 1.0) {
  // Ceramic Pot
  const potW = 1.0 * scale
  const potH = 1.2 * scale
  group.add(makeBoxMesh({
    w: potW,
    h: potH,
    d: potW,
    x,
    y: potH / 2,
    z,
    color: 0xf1f5f9, // Matte white ceramic
    roughness: 0.3,
  }))

  // Soil
  group.add(makeBoxMesh({
    w: potW * 0.9,
    h: 0.1 * scale,
    d: potW * 0.9,
    x,
    y: potH + 0.02,
    z,
    color: 0x3e2723, // Dark soil
  }))

  // Lush Greenery (Foliage crown)
  const foliageGeo = new THREE.DodecahedronGeometry(0.85 * scale, 1)
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.85 })
  const foliage = new THREE.Mesh(foliageGeo, foliageMat)
  foliage.position.set(x, potH + 0.85 * scale, z)
  foliage.castShadow = true
  group.add(foliage)
}

/**
 * Wall Art / Framed Canvas
 */
function buildWallArt(x: number, y: number, z: number, w: number, h: number, orient: 'x' | 'z', group: THREE.Group) {
  const frameD = 0.08
  const frameGeo = orient === 'x' ? new THREE.BoxGeometry(w, h, frameD) : new THREE.BoxGeometry(frameD, h, w)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
  const frameMesh = new THREE.Mesh(frameGeo, frameMat)
  frameMesh.position.set(x, y, z)
  group.add(frameMesh)

  // Inner canvas
  const canvasGeo = orient === 'x' ? new THREE.BoxGeometry(w * 0.92, h * 0.9, frameD * 1.1) : new THREE.BoxGeometry(frameD * 1.1, h * 0.9, w * 0.92)
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 })
  const canvasMesh = new THREE.Mesh(canvasGeo, canvasMat)
  canvasMesh.position.set(x, y, z)
  group.add(canvasMesh)
}

/**
 * Realistic Exterior Windows with Modern Charcoal Frames, Glass, and Curtains/Blinds
 */
interface WindowPlacement {
  wall: 'front' | 'rear' | 'left' | 'right'
  x: number
  z: number
  width: number
}

function buildRealisticWindow(
  win: WindowPlacement,
  wallHeight: number,
  wallThickness: number,
  group: THREE.Group
) {
  const ww = win.width
  const wh = 4.2
  const sillH = 2.8 // Window bottom sill height
  const wt = wallThickness

  const isHoriz = win.wall === 'front' || win.wall === 'rear'
  const frameColor = 0x1e293b // Dark modern bronze/charcoal
  const frameThick = 0.2

  // 1. Outer Window Frame
  const frameOuterGeo = isHoriz
    ? new THREE.BoxGeometry(ww, wh, wt * 1.05)
    : new THREE.BoxGeometry(wt * 1.05, wh, ww)
  const frameOuterMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.4, metalness: 0.6 })
  const frameMesh = new THREE.Mesh(frameOuterGeo, frameOuterMat)
  frameMesh.position.set(win.x, sillH + wh / 2, win.z)
  group.add(frameMesh)

  // 2. Clear Double-Glazed Glass Pane
  const glassGeo = isHoriz
    ? new THREE.BoxGeometry(ww - frameThick * 2, wh - frameThick * 2, wt * 0.25)
    : new THREE.BoxGeometry(wt * 0.25, wh - frameThick * 2, ww - frameThick * 2)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbde0fe,
    transmission: 0.88,
    opacity: 0.7,
    transparent: true,
    roughness: 0.08,
    ior: 1.52,
    reflectivity: 0.7,
  })
  const glassMesh = new THREE.Mesh(glassGeo, glassMat)
  glassMesh.position.set(win.x, sillH + wh / 2, win.z)
  group.add(glassMesh)

  // 3. Central Mullion Bar
  const mullionGeo = isHoriz
    ? new THREE.BoxGeometry(0.18, wh - frameThick * 2, wt * 0.35)
    : new THREE.BoxGeometry(wt * 0.35, wh - frameThick * 2, 0.18)
  const mullion = new THREE.Mesh(mullionGeo, frameOuterMat)
  mullion.position.set(win.x, sillH + wh / 2, win.z)
  group.add(mullion)

  // 4. Elegant Interior Curtains / Fabric Blinds
  const curtainOffset = 0.45
  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, // Off-white linen
    roughness: 0.9,
    metalness: 0.0,
  })

  // Left & Right Drapes
  const drapeW = 0.6
  const drapeH = wh + 0.6
  const drapeGeo = isHoriz
    ? new THREE.BoxGeometry(drapeW, drapeH, 0.18)
    : new THREE.BoxGeometry(0.18, drapeH, drapeW)

  let cLeftX = win.x
  let cLeftZ = win.z
  let cRightX = win.x
  let cRightZ = win.z

  if (win.wall === 'front') {
    cLeftX = win.x - ww / 2 + drapeW / 2
    cLeftZ = win.z + curtainOffset
    cRightX = win.x + ww / 2 - drapeW / 2
    cRightZ = win.z + curtainOffset
  } else if (win.wall === 'rear') {
    cLeftX = win.x - ww / 2 + drapeW / 2
    cLeftZ = win.z - curtainOffset
    cRightX = win.x + ww / 2 - drapeW / 2
    cRightZ = win.z - curtainOffset
  } else if (win.wall === 'left') {
    cLeftX = win.x + curtainOffset
    cLeftZ = win.z - ww / 2 + drapeW / 2
    cRightX = win.x + curtainOffset
    cRightZ = win.z + ww / 2 - drapeW / 2
  } else if (win.wall === 'right') {
    cLeftX = win.x - curtainOffset
    cLeftZ = win.z - ww / 2 + drapeW / 2
    cRightX = win.x - curtainOffset
    cRightZ = win.z + ww / 2 - drapeW / 2
  }

  const leftDrape = new THREE.Mesh(drapeGeo, curtainMat)
  leftDrape.position.set(cLeftX, sillH + drapeH / 2 - 0.2, cLeftZ)
  group.add(leftDrape)

  const rightDrape = new THREE.Mesh(drapeGeo, curtainMat)
  rightDrape.position.set(cRightX, sillH + drapeH / 2 - 0.2, cRightZ)
  group.add(rightDrape)
}

/* =========================================================================
   TASTEFUL ARCHITECTURAL ROOM FURNITURE & DECORATION
   ========================================================================= */

function buildBedroomFurniture(r: RoomItem, group: THREE.Group) {
  const isMaster = (r.name || '').toLowerCase().includes('master')
  const bedW = isMaster ? 5.8 : 5.0
  const bedL = 6.4

  if (r.width < 6.5 || r.height < 7.0) return

  const bedCenterX = r.x + r.width / 2
  const bedCenterZ = r.y + 0.6 + bedL / 2

  // 1. Bed Frame (Warm Natural Oak)
  group.add(makeBoxMesh({
    w: bedW + 0.3,
    h: 0.65,
    d: bedL + 0.3,
    x: bedCenterX,
    y: 0.325,
    z: bedCenterZ,
    color: 0xc8b69b,
    roughness: 0.7,
  }))

  // 2. Plush Mattress (Warm White)
  group.add(makeBoxMesh({
    w: bedW,
    h: 0.85,
    d: bedL,
    x: bedCenterX,
    y: 0.65 + 0.425,
    z: bedCenterZ,
    color: 0xfdfdfd,
    roughness: 0.9,
  }))

  // 3. Upholstered Headboard (Neutral Grey/Beige)
  group.add(makeBoxMesh({
    w: bedW + 0.6,
    h: 2.8,
    d: 0.35,
    x: bedCenterX,
    y: 1.4,
    z: r.y + 0.4 + 0.175,
    color: 0x475569, // Soft slate fabric
    roughness: 0.85,
  }))

  // 4. Designer Duvet
  group.add(makeBoxMesh({
    w: bedW + 0.1,
    h: 0.25,
    d: bedL * 0.58,
    x: bedCenterX,
    y: 1.35,
    z: bedCenterZ + bedL * 0.19,
    color: 0x94a3b8, // Light architectural grey
    roughness: 0.85,
  }))

  // 5. Twin Pillows
  const pillowW = bedW * 0.38
  const pillowL = 1.4
  group.add(makeBoxMesh({
    w: pillowW,
    h: 0.35,
    d: pillowL,
    x: bedCenterX - bedW * 0.25,
    y: 1.45,
    z: r.y + 0.8 + pillowL / 2,
    color: 0xffffff,
  }))
  group.add(makeBoxMesh({
    w: pillowW,
    h: 0.35,
    d: pillowL,
    x: bedCenterX + bedW * 0.25,
    y: 1.45,
    z: r.y + 0.8 + pillowL / 2,
    color: 0xffffff,
  }))

  // 6. Bedside Nightstands & Designer Lamps
  const sideW = 1.4
  const sideD = 1.3
  const sideH = 1.4
  const leftSideX = bedCenterX - (bedW / 2 + 0.4 + sideW / 2)
  const rightSideX = bedCenterX + (bedW / 2 + 0.4 + sideW / 2)

  if (leftSideX - sideW / 2 > r.x + 0.3) {
    group.add(makeBoxMesh({
      w: sideW,
      h: sideH,
      d: sideD,
      x: leftSideX,
      y: sideH / 2,
      z: r.y + 0.5 + sideD / 2,
      color: 0xb89f81,
    }))
    // Brass / warm lamp
    group.add(makeBoxMesh({
      w: 0.45,
      h: 0.85,
      d: 0.45,
      x: leftSideX,
      y: sideH + 0.425,
      z: r.y + 0.5 + sideD / 2,
      color: 0xfef08a,
      roughness: 0.3,
    }))
  }

  if (rightSideX + sideW / 2 < r.x + r.width - 0.3) {
    group.add(makeBoxMesh({
      w: sideW,
      h: sideH,
      d: sideD,
      x: rightSideX,
      y: sideH / 2,
      z: r.y + 0.5 + sideD / 2,
      color: 0xb89f81,
    }))
    group.add(makeBoxMesh({
      w: 0.45,
      h: 0.85,
      d: 0.45,
      x: rightSideX,
      y: sideH + 0.425,
      z: r.y + 0.5 + sideD / 2,
      color: 0xfef08a,
      roughness: 0.3,
    }))
  }

  // 7. Bedroom Floor Rug
  group.add(makeBoxMesh({
    w: bedW + 3.0,
    h: 0.04,
    d: bedL + 1.2,
    x: bedCenterX,
    y: 0.08,
    z: bedCenterZ + 0.8,
    color: 0xe2e8f0, // Soft ivory carpet
    roughness: 0.95,
  }))

  // 8. Wardrobe
  if (r.height >= 11 && r.width >= 10) {
    const wardW = Math.min(6.2, r.width * 0.45)
    const wardD = 1.8
    const wardH = 6.8
    group.add(makeBoxMesh({
      w: wardW,
      h: wardH,
      d: wardD,
      x: r.x + r.width - wardW / 2 - 0.4,
      y: wardH / 2,
      z: r.y + r.height - wardD / 2 - 0.4,
      color: 0x334155,
      roughness: 0.6,
    }))
  }

  // 9. Indoor Potted Plant in Corner
  if (r.width >= 10 && r.height >= 10) {
    buildPlant(r.x + 1.2, r.y + r.height - 1.2, group, 0.9)
  }

  // 10. Wall Art above Bed
  buildWallArt(bedCenterX, 4.5, r.y + 0.32, bedW * 0.6, 2.0, 'x', group)
}

function buildLivingFurniture(r: RoomItem, group: THREE.Group) {
  if (r.width < 8 || r.height < 8) return

  const centerX = r.x + r.width * 0.46
  const centerZ = r.y + r.height * 0.5

  // 1. Large Area Rug (Neutral Textured Cream)
  const rugW = Math.min(r.width * 0.65, 11.0)
  const rugD = Math.min(r.height * 0.65, 8.5)
  group.add(makeBoxMesh({
    w: rugW,
    h: 0.04,
    d: rugD,
    x: centerX,
    y: 0.07,
    z: centerZ,
    color: 0xe2e8f0,
    roughness: 0.95,
  }))

  // 2. Modern 3-Seater Sofa (Neutral Warm Grey)
  const sofaW = Math.min(rugW * 0.76, 7.8)
  const sofaD = 2.8
  const sofaH = 2.4
  const sofaSeatH = 1.2
  const sofaZ = centerZ - rugD * 0.26

  // Base Cushion
  group.add(makeBoxMesh({
    w: sofaW,
    h: sofaSeatH,
    d: sofaD,
    x: centerX,
    y: sofaSeatH / 2,
    z: sofaZ,
    color: 0x64748b, // Modern neutral slate
    roughness: 0.85,
  }))

  // Backrest
  group.add(makeBoxMesh({
    w: sofaW,
    h: sofaH - sofaSeatH + 0.4,
    d: 0.6,
    x: centerX,
    y: sofaSeatH + (sofaH - sofaSeatH + 0.4) / 2,
    z: sofaZ - sofaD / 2 + 0.3,
    color: 0x475569,
    roughness: 0.85,
  }))

  // Left & Right Armrests
  group.add(makeBoxMesh({
    w: 0.5,
    h: 1.8,
    d: sofaD,
    x: centerX - sofaW / 2 + 0.25,
    y: 0.9,
    z: sofaZ,
    color: 0x475569,
  }))
  group.add(makeBoxMesh({
    w: 0.5,
    h: 1.8,
    d: sofaD,
    x: centerX + sofaW / 2 - 0.25,
    y: 0.9,
    z: sofaZ,
    color: 0x475569,
  }))

  // 3. Wooden Coffee Table
  const tableW = Math.min(sofaW * 0.6, 4.4)
  const tableD = 2.2
  const tableH = 1.3
  group.add(makeBoxMesh({
    w: tableW,
    h: 0.2,
    d: tableD,
    x: centerX,
    y: tableH,
    z: centerZ + 0.4,
    color: 0xd4a373, // Oak top
    roughness: 0.45,
  }))
  group.add(makeBoxMesh({
    w: tableW * 0.85,
    h: tableH - 0.2,
    d: tableD * 0.7,
    x: centerX,
    y: (tableH - 0.2) / 2,
    z: centerZ + 0.4,
    color: 0x1e293b, // Matte dark steel legs
  }))

  // 4. Accent Lounge Armchair
  const chairW = 2.4
  const chairD = 2.4
  group.add(makeBoxMesh({
    w: chairW,
    h: 1.1,
    d: chairD,
    x: centerX - rugW * 0.4,
    y: 0.55,
    z: centerZ + 0.6,
    color: 0xb45309, // Warm terracotta leather
    roughness: 0.75,
  }))

  // 5. Entertainment Console / TV Unit against wall
  const consoleW = Math.min(sofaW + 1.2, 8.4)
  const consoleD = 1.4
  const consoleH = 1.5
  const consoleZ = r.y + r.height - consoleD / 2 - 0.4
  group.add(makeBoxMesh({
    w: consoleW,
    h: consoleH,
    d: consoleD,
    x: centerX,
    y: consoleH / 2,
    z: consoleZ,
    color: 0x0f172a, // Deep slate console
  }))

  // 6. Flat Screen TV
  const tvW = consoleW * 0.7
  const tvH = 2.7
  group.add(makeBoxMesh({
    w: tvW,
    h: tvH,
    d: 0.15,
    x: centerX,
    y: consoleH + tvH / 2 + 0.5,
    z: consoleZ,
    color: 0x020617,
    metalness: 0.85,
    roughness: 0.2,
  }))

  // 7. Indoor Plants (Potted Fiddle Leaf / Monsteras)
  buildPlant(r.x + 1.4, r.y + 1.4, group, 1.2)
  buildPlant(r.x + r.width - 1.4, r.y + r.height - 1.4, group, 1.0)

  // 8. Wall Art above sofa
  buildWallArt(centerX, 4.8, sofaZ - sofaD / 2 - 0.1, sofaW * 0.7, 2.2, 'x', group)
}

function buildKitchenFurniture(r: RoomItem, group: THREE.Group) {
  if (r.width < 5 || r.height < 5) return

  const counterH = 2.85
  const counterD = 2.2

  // 1. Modular Counter along top wall
  const mainCounterW = Math.max(3.0, r.width - 2.8)
  const counterCenterX = r.x + 0.4 + mainCounterW / 2
  const counterCenterZ = r.y + counterD / 2 + 0.35

  // Matte Dark Cabinets
  group.add(makeBoxMesh({
    w: mainCounterW,
    h: counterH - 0.15,
    d: counterD,
    x: counterCenterX,
    y: (counterH - 0.15) / 2,
    z: counterCenterZ,
    color: 0x1e293b,
  }))

  // White Quartz Slab
  group.add(makeBoxMesh({
    w: mainCounterW + 0.1,
    h: 0.15,
    d: counterD + 0.1,
    x: counterCenterX,
    y: counterH - 0.075,
    z: counterCenterZ,
    color: 0xf8fafc,
    roughness: 0.2,
  }))

  // 2. Ceramic Induction Stove / Hob
  const hobW = 2.3
  const hobD = 1.7
  group.add(makeBoxMesh({
    w: hobW,
    h: 0.06,
    d: hobD,
    x: counterCenterX - mainCounterW * 0.22,
    y: counterH + 0.03,
    z: counterCenterZ,
    color: 0x09090b,
    metalness: 0.7,
    roughness: 0.15,
  }))

  // 3. Kitchen Sink with Chrome Faucet
  const sinkW = 2.2
  const sinkD = 1.6
  group.add(makeBoxMesh({
    w: sinkW,
    h: 0.05,
    d: sinkD,
    x: counterCenterX + mainCounterW * 0.22,
    y: counterH + 0.02,
    z: counterCenterZ,
    color: 0x94a3b8, // Stainless steel
    metalness: 0.9,
    roughness: 0.2,
  }))

  // 4. Modern Tall Refrigerator
  const fridgeW = 2.6
  const fridgeD = 2.5
  const fridgeH = 6.2
  group.add(makeBoxMesh({
    w: fridgeW,
    h: fridgeH,
    d: fridgeD,
    x: r.x + r.width - fridgeW / 2 - 0.4,
    y: fridgeH / 2,
    z: r.y + fridgeD / 2 + 0.4,
    color: 0x475569, // Brushed graphite finish
    metalness: 0.6,
    roughness: 0.35,
  }))

  // 5. Upper Storage Cabinets
  const upperH = 2.2
  const upperD = 1.2
  group.add(makeBoxMesh({
    w: mainCounterW,
    h: upperH,
    d: upperD,
    x: counterCenterX,
    y: counterH + 2.0 + upperH / 2,
    z: r.y + upperD / 2 + 0.35,
    color: 0x334155,
  }))
}

function buildDiningFurniture(r: RoomItem, group: THREE.Group) {
  if (r.width < 6 || r.height < 6) return

  const centerX = r.x + r.width / 2
  const centerZ = r.y + r.height / 2

  const tableW = Math.min(r.width * 0.55, 5.6)
  const tableD = Math.min(r.height * 0.45, 3.4)
  const tableH = 2.45

  // 1. Natural Wood Dining Tabletop
  group.add(makeBoxMesh({
    w: tableW,
    h: 0.2,
    d: tableD,
    x: centerX,
    y: tableH,
    z: centerZ,
    color: 0xba9a76, // Warm natural oak
    roughness: 0.4,
  }))

  // Table Legs
  const legW = 0.28
  const legH = tableH - 0.1
  const legOffsetX = tableW / 2 - 0.35
  const legOffsetZ = tableD / 2 - 0.35
  ;[
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([sx, sz]) => {
    group.add(makeBoxMesh({
      w: legW,
      h: legH,
      d: legW,
      x: centerX + sx * legOffsetX,
      y: legH / 2,
      z: centerZ + sz * legOffsetZ,
      color: 0x1e293b,
    }))
  })

  // Table Floral / Ceramic Centerpiece
  group.add(makeBoxMesh({
    w: 0.8,
    h: 0.4,
    d: 0.8,
    x: centerX,
    y: tableH + 0.2,
    z: centerZ,
    color: 0x2d6a4f, // Greenery vase
  }))

  // 2. Comfortable Dining Chairs (North & South)
  const chairW = 1.4
  const chairD = 1.3
  const chairSeatH = 1.35
  const chairBackH = 1.45
  const chairSpacing = tableW * 0.26

  ;[-1, 1].forEach((dir) => {
    const cx = centerX + dir * chairSpacing
    // North Chair
    group.add(makeBoxMesh({
      w: chairW,
      h: 0.15,
      d: chairD,
      x: cx,
      y: chairSeatH,
      z: centerZ - tableD / 2 - 0.65,
      color: 0x475569,
    }))
    group.add(makeBoxMesh({
      w: chairW,
      h: chairBackH,
      d: 0.15,
      x: cx,
      y: chairSeatH + chairBackH / 2,
      z: centerZ - tableD / 2 - 0.65 - chairD / 2 + 0.08,
      color: 0x1e293b,
    }))

    // South Chair
    group.add(makeBoxMesh({
      w: chairW,
      h: 0.15,
      d: chairD,
      x: cx,
      y: chairSeatH,
      z: centerZ + tableD / 2 + 0.65,
      color: 0x475569,
    }))
    group.add(makeBoxMesh({
      w: chairW,
      h: chairBackH,
      d: 0.15,
      x: cx,
      y: chairSeatH + chairBackH / 2,
      z: centerZ + tableD / 2 + 0.65 + chairD / 2 - 0.08,
      color: 0x1e293b,
    }))
  })

  // 3. Dining Area Rug
  group.add(makeBoxMesh({
    w: tableW + 3.2,
    h: 0.04,
    d: tableD + 3.2,
    x: centerX,
    y: 0.07,
    z: centerZ,
    color: 0xe2e8f0,
    roughness: 0.95,
  }))
}

function buildBathroomFurniture(r: RoomItem, group: THREE.Group) {
  if (r.width < 4 || r.height < 4) return

  // 1. Ceramic Toilet
  const toiletX = r.x + 1.3
  const toiletZ = r.y + 1.4
  // Cistern tank
  group.add(makeBoxMesh({
    w: 1.4,
    h: 1.8,
    d: 0.7,
    x: toiletX,
    y: 0.9,
    z: r.y + 0.35 + 0.35,
    color: 0xffffff,
    roughness: 0.15,
  }))
  // Bowl
  group.add(makeBoxMesh({
    w: 1.2,
    h: 1.2,
    d: 1.4,
    x: toiletX,
    y: 0.6,
    z: r.y + 0.7 + 0.7,
    color: 0xf8fafc,
    roughness: 0.15,
  }))

  // 2. Vanity Cabinet & Sink
  const sinkX = r.x + r.width - 1.4
  const sinkZ = r.y + 1.4
  group.add(makeBoxMesh({
    w: 2.1,
    h: 2.4,
    d: 1.4,
    x: sinkX,
    y: 1.2,
    z: sinkZ,
    color: 0x1e293b,
  }))
  // Ceramic Basin
  group.add(makeBoxMesh({
    w: 1.7,
    h: 0.4,
    d: 1.1,
    x: sinkX,
    y: 2.5,
    z: sinkZ,
    color: 0xffffff,
    roughness: 0.1,
  }))
  // Wall Mirror
  group.add(makeBoxMesh({
    w: 1.9,
    h: 2.6,
    d: 0.08,
    x: sinkX,
    y: 4.4,
    z: r.y + 0.38,
    color: 0xbde0fe,
    metalness: 0.98,
    roughness: 0.02,
  }))

  // 3. Walk-in Shower Enclosure
  if (r.height >= 6.5) {
    const showerW = Math.min(3.5, r.width * 0.55)
    const showerD = 3.2
    const showerX = r.x + r.width - showerW / 2 - 0.3
    const showerZ = r.y + r.height - showerD / 2 - 0.3

    // Tray
    group.add(makeBoxMesh({
      w: showerW,
      h: 0.15,
      d: showerD,
      x: showerX,
      y: 0.08,
      z: showerZ,
      color: 0xf1f5f9,
    }))

    // Glass Screen
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbde0fe,
      transmission: 0.88,
      opacity: 0.55,
      transparent: true,
      roughness: 0.08,
      ior: 1.5,
    })
    const glassGeo = new THREE.BoxGeometry(showerW, 6.2, 0.1)
    const glassMesh = new THREE.Mesh(glassGeo, glassMat)
    glassMesh.position.set(showerX, 3.1, showerZ - showerD / 2)
    group.add(glassMesh)
  }
}

function buildParkingFurniture(r: RoomItem, group: THREE.Group) {
  if (r.width < 7 || r.height < 10) return

  const carX = r.x + r.width / 2
  const carZ = r.y + r.height / 2
  const carW = 5.2
  const carL = 11.0

  // 1. Parking Bay Painted Markings
  const lineMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 2 })
  const bayPoints = [
    new THREE.Vector3(carX - carW * 0.65, 0.08, carZ - carL * 0.55),
    new THREE.Vector3(carX - carW * 0.65, 0.08, carZ + carL * 0.55),
    new THREE.Vector3(carX + carW * 0.65, 0.08, carZ + carL * 0.55),
    new THREE.Vector3(carX + carW * 0.65, 0.08, carZ - carL * 0.55),
  ]
  const bayGeo = new THREE.BufferGeometry().setFromPoints(bayPoints)
  group.add(new THREE.Line(bayGeo, lineMat))

  // 2. Sedan Chassis
  group.add(makeBoxMesh({
    w: carW,
    h: 1.3,
    d: carL,
    x: carX,
    y: 0.95,
    z: carZ,
    color: 0x1e3a8a, // Metallic deep blue
    metalness: 0.85,
    roughness: 0.25,
  }))

  // 3. Cabin / Greenhouse
  const cabinW = carW * 0.82
  const cabinL = carL * 0.52
  const cabinH = 1.3
  group.add(makeBoxMesh({
    w: cabinW,
    h: cabinH,
    d: cabinL,
    x: carX,
    y: 1.6 + cabinH / 2,
    z: carZ - 0.3,
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.1,
  }))

  // 4. Wheels
  const wheelW = 0.5
  const wheelR = 0.75
  ;[
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([sx, sz]) => {
    group.add(makeBoxMesh({
      w: wheelW,
      h: wheelR * 2,
      d: wheelR * 2,
      x: carX + sx * (carW / 2 + 0.1),
      y: wheelR,
      z: carZ + sz * (carL * 0.3),
      color: 0x09090b,
      roughness: 0.9,
    }))
  })

  // Headlights & Taillights
  group.add(makeBoxMesh({
    w: carW * 0.8,
    h: 0.3,
    d: 0.1,
    x: carX,
    y: 1.2,
    z: carZ - carL / 2 - 0.05,
    color: 0x7de7ff,
  }))
  group.add(makeBoxMesh({
    w: carW * 0.8,
    h: 0.3,
    d: 0.1,
    x: carX,
    y: 1.2,
    z: carZ + carL / 2 + 0.05,
    color: 0xef4444,
  }))
}

function buildBalconyFurniture(r: RoomItem, group: THREE.Group) {
  if (r.width < 4 || r.height < 4) return

  const centerX = r.x + r.width / 2
  const centerZ = r.y + r.height / 2

  // Bistro Table
  group.add(makeBoxMesh({
    w: 2.0,
    h: 0.15,
    d: 2.0,
    x: centerX,
    y: 1.8,
    z: centerZ,
    color: 0x1e293b,
  }))
  group.add(makeBoxMesh({
    w: 0.3,
    h: 1.7,
    d: 0.3,
    x: centerX,
    y: 0.85,
    z: centerZ,
    color: 0x0f172a,
  }))

  // Patio Twin Chairs
  ;[-1, 1].forEach((dir) => {
    group.add(makeBoxMesh({
      w: 1.2,
      h: 1.0,
      d: 1.2,
      x: centerX + dir * 1.8,
      y: 0.5,
      z: centerZ,
      color: 0x10b981,
    }))
  })

  // Planter
  buildPlant(r.x + 0.9, r.y + 0.9, group, 0.9)
}

function buildStudyFurniture(r: RoomItem, group: THREE.Group) {
  if (r.width < 5 || r.height < 5) return

  const deskW = Math.min(r.width * 0.6, 5.2)
  const deskD = 2.4
  const deskH = 2.4
  const deskX = r.x + r.width / 2
  const deskZ = r.y + deskD / 2 + 0.6

  // Desk top (Walnut)
  group.add(makeBoxMesh({
    w: deskW,
    h: 0.2,
    d: deskD,
    x: deskX,
    y: deskH,
    z: deskZ,
    color: 0x451a03,
    roughness: 0.45,
  }))

  // Pedestals
  group.add(makeBoxMesh({
    w: 1.2,
    h: deskH - 0.2,
    d: deskD * 0.9,
    x: deskX - deskW / 2 + 0.7,
    y: (deskH - 0.2) / 2,
    z: deskZ,
    color: 0x1e293b,
  }))
  group.add(makeBoxMesh({
    w: 1.2,
    h: deskH - 0.2,
    d: deskD * 0.9,
    x: deskX + deskW / 2 - 0.7,
    y: (deskH - 0.2) / 2,
    z: deskZ,
    color: 0x1e293b,
  }))

  // Office Chair
  group.add(makeBoxMesh({
    w: 1.4,
    h: 1.4,
    d: 1.4,
    x: deskX,
    y: 0.7,
    z: deskZ + deskD * 0.65,
    color: 0x334155,
  }))

  // Plant
  buildPlant(r.x + 1.2, r.y + r.height - 1.2, group, 0.85)
}

function populateRoomFurniture(r: RoomItem, group: THREE.Group) {
  const t = (r.type || r.room || r.name || '').toLowerCase()

  if (t.includes('bed')) {
    buildBedroomFurniture(r, group)
  } else if (t.includes('liv') || t.includes('hall')) {
    buildLivingFurniture(r, group)
  } else if (t.includes('kitch')) {
    buildKitchenFurniture(r, group)
  } else if (t.includes('din')) {
    buildDiningFurniture(r, group)
  } else if (t.includes('bath') || t.includes('toilet') || t.includes('wash')) {
    buildBathroomFurniture(r, group)
  } else if (t.includes('park') || t.includes('garage')) {
    buildParkingFurniture(r, group)
  } else if (t.includes('balc') || t.includes('terrace')) {
    buildBalconyFurniture(r, group)
  } else if (t.includes('study') || t.includes('office')) {
    buildStudyFurniture(r, group)
  }
}

/* =========================================================================
   MAIN THREE.JS FLOOR PLAN 3D VIEWER COMPONENT
   ========================================================================= */

export const FloorPlan3DViewer: React.FC<FloorPlan3DViewerProps> = ({ layout, onBackTo2D }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [wallHeight, setWallHeight] = useState<number>(8.0) // feet
  const [showCeilingCutaway, setShowCeilingCutaway] = useState<boolean>(false)
  const [showFurniture, setShowFurniture] = useState<boolean>(true)
  const [showLabels, setShowLabels] = useState<boolean>(true)
  const [wireframeMode, setWireframeMode] = useState<boolean>(false)

  // Camera & scene controller refs for toolbar actions
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const initialCamPos = useRef<THREE.Vector3>(new THREE.Vector3())

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x060c16)
    scene.fog = new THREE.FogExp2(0x060c16, 0.007)

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 1000)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2.05
    controls.minDistance = 8
    controls.maxDistance = 250
    controlsRef.current = controls

    // Plot Dimensions in feet
    const plotW = layout.plot?.width || 30
    const plotL = layout.plot?.length || 40
    const centerX = plotW / 2
    const centerZ = plotL / 2

    // Set camera looking at center
    const diag = Math.sqrt(plotW * plotW + plotL * plotL)
    camera.position.set(centerX + diag * 0.7, diag * 1.05, centerZ + diag * 0.9)
    initialCamPos.current.copy(camera.position)
    controls.target.set(centerX, 0, centerZ)
    controls.update()

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.9)
    sunLight.position.set(centerX + 40, 60, centerZ - 30)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 5
    sunLight.shadow.camera.far = 200
    const d = Math.max(plotW, plotL)
    sunLight.shadow.camera.left = -d
    sunLight.shadow.camera.right = d
    sunLight.shadow.camera.top = d
    sunLight.shadow.camera.bottom = -d
    sunLight.shadow.bias = -0.0008
    scene.add(sunLight)

    const blueFill = new THREE.DirectionalLight(0x7de7ff, 0.7)
    blueFill.position.set(centerX - 35, 40, centerZ + 35)
    scene.add(blueFill)

    const warmFill = new THREE.DirectionalLight(0xfef08a, 0.45)
    warmFill.position.set(centerX, -15, centerZ)
    scene.add(warmFill)

    // Ground Grid & Exterior Terrain
    const gridHelper = new THREE.GridHelper(Math.max(plotW, plotL) * 3, 40, 0x1d3557, 0x0c1e34)
    gridHelper.position.set(centerX, -0.15, centerZ)
    scene.add(gridHelper)

    // Site / Foundation Base Slab
    const foundationGeo = new THREE.BoxGeometry(plotW + 6, 0.6, plotL + 6)
    const foundationMat = new THREE.MeshStandardMaterial({
      color: 0x091424,
      roughness: 0.9,
      metalness: 0.1,
    })
    const foundation = new THREE.Mesh(foundationGeo, foundationMat)
    foundation.position.set(centerX, -0.3, centerZ)
    foundation.receiveShadow = true
    scene.add(foundation)

    // Plot Border Line (Glowing Cyan boundary)
    const plotBorderPoints = [
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(plotW, 0.05, 0),
      new THREE.Vector3(plotW, 0.05, plotL),
      new THREE.Vector3(0, 0.05, plotL),
      new THREE.Vector3(0, 0.05, 0),
    ]
    const plotBorderGeo = new THREE.BufferGeometry().setFromPoints(plotBorderPoints)
    const plotBorderMat = new THREE.LineBasicMaterial({ color: 0x7de7ff, linewidth: 2 })
    const plotLine = new THREE.Line(plotBorderGeo, plotBorderMat)
    scene.add(plotLine)

    // Dynamic model group
    const dynamicModelGroup = new THREE.Group()
    scene.add(dynamicModelGroup)

    const wallThickness = 0.55 // feet
    const h = wallHeight

    // Premium Architectural Wall Materials
    const extWallMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Warm modern off-white exterior
      roughness: 0.6,
      metalness: 0.02,
      wireframe: wireframeMode,
    })

    const intWallMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Clean matte interior plaster
      roughness: 0.65,
      metalness: 0.01,
      wireframe: wireframeMode,
    })

    const doorWoodMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // Warm architectural teak wood
      roughness: 0.6,
      metalness: 0.05,
    })

    const rooms = layout.rooms || []

    // 1. Render Rooms (Floors, Subtle Badges, Furniture)
    rooms.forEach((r) => {
      const finish = getRoomFinish(r.type || r.room || r.name)

      // Floor Surface Mesh
      const floorPadding = 0.05
      const floorGeo = new THREE.BoxGeometry(
        Math.max(0.1, r.width - floorPadding * 2),
        0.1,
        Math.max(0.1, r.height - floorPadding * 2)
      )
      const floorMat = new THREE.MeshStandardMaterial({
        color: finish.floorColor,
        roughness: finish.roughness,
        metalness: 0.08,
        wireframe: wireframeMode,
      })
      const floorMesh = new THREE.Mesh(floorGeo, floorMat)
      floorMesh.position.set(r.x + r.width / 2, 0.05, r.y + r.height / 2)
      floorMesh.receiveShadow = true
      dynamicModelGroup.add(floorMesh)

      // Subtle, Compact Floating Room Badge
      if (showLabels) {
        const roomTitle = r.name || r.room || r.type || 'Room'
        const roomArea = Math.round(r.width * r.height)
        const subTitle = `${r.width}'×${r.height}' (${roomArea} sq.ft)`
        const sprite = createSubtleRoomBadge(roomTitle, subTitle, finish.accent)
        const badgeScale = Math.min(2.8, Math.max(1.6, Math.min(r.width, r.height) * 0.32))
        sprite.scale.set(badgeScale * 2.2, badgeScale * 0.65, 1)
        sprite.position.set(r.x + r.width / 2, h + 0.6, r.y + r.height / 2)
        dynamicModelGroup.add(sprite)
      }

      // Perimeter Trim Line
      const baseBorderPoints = [
        new THREE.Vector3(r.x, 0.12, r.y),
        new THREE.Vector3(r.x + r.width, 0.12, r.y),
        new THREE.Vector3(r.x + r.width, 0.12, r.y + r.height),
        new THREE.Vector3(r.x, 0.12, r.y + r.height),
        new THREE.Vector3(r.x, 0.12, r.y),
      ]
      const baseBorderGeo = new THREE.BufferGeometry().setFromPoints(baseBorderPoints)
      const baseBorderMat = new THREE.LineBasicMaterial({ color: new THREE.Color(finish.accent) })
      dynamicModelGroup.add(new THREE.Line(baseBorderGeo, baseBorderMat))

      // Procedural Dynamic Architectural Furniture
      if (showFurniture) {
        populateRoomFurniture(r, dynamicModelGroup)
      }
    })

    // 2. Build 3D Walls
    const addWallSegment = (
      x: number,
      z: number,
      lenX: number,
      lenZ: number,
      heightVal: number,
      isExterior: boolean
    ) => {
      const geo = new THREE.BoxGeometry(lenX, heightVal, lenZ)
      const mat = isExterior ? extWallMat : intWallMat
      const wall = new THREE.Mesh(geo, mat)
      wall.position.set(x + lenX / 2, heightVal / 2, z + lenZ / 2)
      wall.castShadow = true
      wall.receiveShadow = true
      dynamicModelGroup.add(wall)
    }

    // Perimeter Walls
    addWallSegment(0, 0, plotW, wallThickness, h, true)
    addWallSegment(0, plotL - wallThickness, plotW, wallThickness, h, true)
    addWallSegment(0, 0, wallThickness, plotL, h, true)
    addWallSegment(plotW - wallThickness, 0, wallThickness, plotL, h, true)

    // Interior Partition Walls
    rooms.forEach((r) => {
      if (r.y > wallThickness + 0.1) {
        addWallSegment(r.x, r.y - wallThickness / 2, r.width, wallThickness, h, false)
      }
      if (r.y + r.height < plotL - wallThickness - 0.1) {
        addWallSegment(r.x, r.y + r.height - wallThickness / 2, r.width, wallThickness, h, false)
      }
      if (r.x > wallThickness + 0.1) {
        addWallSegment(r.x - wallThickness / 2, r.y, wallThickness, r.height, h, false)
      }
      if (r.x + r.width < plotW - wallThickness - 0.1) {
        addWallSegment(r.x + r.width - wallThickness / 2, r.y, wallThickness, r.height, h, false)
      }
    })

    // 3. Doors
    const doors = layout.doors || []
    doors.forEach((d) => {
      const dw = d.width || 3.0
      const dh = 6.8
      const doorGeo = new THREE.BoxGeometry(dw, dh, wallThickness * 0.8)
      const doorMesh = new THREE.Mesh(doorGeo, doorWoodMat)
      doorMesh.position.set(d.x, dh / 2, d.y)
      doorMesh.castShadow = true
      dynamicModelGroup.add(doorMesh)

      // Lintel beam above
      const lintelGeo = new THREE.BoxGeometry(dw, h - dh, wallThickness * 1.05)
      const lintel = new THREE.Mesh(lintelGeo, intWallMat)
      lintel.position.set(d.x, dh + (h - dh) / 2, d.y)
      dynamicModelGroup.add(lintel)
    })

    // 4. Compute & Render Realistic Exterior Windows (with Frames, Glass, and Curtains)
    const windowPlacements: WindowPlacement[] = []
    const tol = 0.3

    rooms.forEach((r) => {
      const rtype = (r.type || r.room || r.name || '').toLowerCase()
      // Skip window placement on parking garages
      if (rtype.includes('park') || rtype.includes('garage')) return

      const winWidth = Math.min(4.5, Math.max(3.0, (r.width >= 10 ? 4.0 : 3.0)))

      // Check Front Exterior Facade (y touches 0)
      if (Math.abs(r.y) < tol && r.width >= 6.0) {
        const wx = r.x + r.width / 2
        // Ensure no door clash on front
        const doorConflict = doors.some((d) => Math.abs(d.y) < tol && Math.abs(d.x - wx) < 3.0)
        if (!doorConflict) {
          windowPlacements.push({ wall: 'front', x: wx, z: wallThickness / 2, width: winWidth })
        }
      }

      // Check Rear Exterior Facade (y + height touches plotL)
      if (Math.abs(r.y + r.height - plotL) < tol && r.width >= 6.0) {
        const wx = r.x + r.width / 2
        windowPlacements.push({ wall: 'rear', x: wx, z: plotL - wallThickness / 2, width: winWidth })
      }

      // Check Left Exterior Facade (x touches 0)
      if (Math.abs(r.x) < tol && r.height >= 7.0) {
        const wz = r.y + r.height / 2
        windowPlacements.push({ wall: 'left', x: wallThickness / 2, z: wz, width: winWidth })
      }

      // Check Right Exterior Facade (x + width touches plotW)
      if (Math.abs(r.x + r.width - plotW) < tol && r.height >= 7.0) {
        const wz = r.y + r.height / 2
        windowPlacements.push({ wall: 'right', x: plotW - wallThickness / 2, z: wz, width: winWidth })
      }
    })

    // Render realistic windows
    windowPlacements.forEach((wp) => {
      buildRealisticWindow(wp, h, wallThickness, dynamicModelGroup)
    })

    // Optional Ceiling cutaway
    if (showCeilingCutaway) {
      const ceilingGeo = new THREE.BoxGeometry(plotW, 0.3, plotL)
      const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0x1d3557,
        roughness: 0.8,
        opacity: 0.35,
        transparent: true,
      })
      const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat)
      ceilingMesh.position.set(centerX, h + 0.15, centerZ)
      dynamicModelGroup.add(ceilingMesh)
    }

    // Animation loop
    let animationFrameId: number

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container) return
      const newW = container.clientWidth
      const newH = container.clientHeight
      camera.aspect = newW / newH
      camera.updateProjectionMatrix()
      renderer.setSize(newW, newH)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [layout, wallHeight, showCeilingCutaway, showFurniture, showLabels, wireframeMode])

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(initialCamPos.current)
      const plotW = layout.plot?.width || 30
      const plotL = layout.plot?.length || 40
      controlsRef.current.target.set(plotW / 2, 0, plotL / 2)
      controlsRef.current.update()
    }
  }

  const handleTopView = () => {
    if (cameraRef.current && controlsRef.current) {
      const plotW = layout.plot?.width || 30
      const plotL = layout.plot?.length || 40
      const maxDim = Math.max(plotW, plotL)
      cameraRef.current.position.set(plotW / 2, maxDim * 1.8, plotL / 2 + 0.1)
      controlsRef.current.target.set(plotW / 2, 0, plotL / 2)
      controlsRef.current.update()
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '620px', display: 'flex', flexDirection: 'column' }}>
      {/* 3D VIEWPORT HEADER BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          background: 'rgba(6, 12, 22, 0.95)',
          borderBottom: '1px solid rgba(125, 231, 255, 0.2)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBackTo2D}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(125, 231, 255, 0.12)',
              border: '1px solid #7de7ff',
              color: '#7de7ff',
              padding: '6px 14px',
              borderRadius: '4px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            ← BACK TO 2D BLUEPRINT
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: '9px', color: '#7de7ff', letterSpacing: '0.12em' }}>
              THREE.JS ARCHITECTURAL 3D ENGINE
            </span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#f5f5f2' }}>
              {layout.plot?.width}×{layout.plot?.length} FT REAL-TIME SPATIAL WALKTHROUGH
            </span>
          </div>
        </div>

        {/* CONTROLS TOOLBAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowFurniture(!showFurniture)}
            className="technical-btn"
            style={{
              padding: '6px 10px',
              fontSize: '10px',
              background: showFurniture ? 'rgba(125, 231, 255, 0.2)' : undefined,
              borderColor: showFurniture ? '#7de7ff' : undefined,
              color: showFurniture ? '#7de7ff' : undefined,
            }}
            title="Toggle Procedural 3D Furniture"
          >
            FURNITURE {showFurniture ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className="technical-btn"
            style={{
              padding: '6px 10px',
              fontSize: '10px',
              background: showLabels ? 'rgba(125, 231, 255, 0.2)' : undefined,
              borderColor: showLabels ? '#7de7ff' : undefined,
              color: showLabels ? '#7de7ff' : undefined,
            }}
            title="Toggle Room Badges"
          >
            LABELS {showLabels ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleTopView}
            className="technical-btn"
            style={{ padding: '6px 10px', fontSize: '10px' }}
            title="Orthographic Top-Down View"
          >
            TOP VIEW
          </button>

          <button
            onClick={handleResetCamera}
            className="technical-btn"
            style={{ padding: '6px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Reset Perspective Angle"
          >
            <RotateCcw size={12} />
            RESET
          </button>

          <button
            onClick={() => setWireframeMode(!wireframeMode)}
            className="technical-btn"
            style={{
              padding: '6px 10px',
              fontSize: '10px',
              background: wireframeMode ? 'rgba(125, 231, 255, 0.2)' : undefined,
              borderColor: wireframeMode ? '#7de7ff' : undefined,
            }}
            title="Toggle Wireframe Structural Mode"
          >
            WIREFRAME
          </button>

          <button
            onClick={() => setShowCeilingCutaway(!showCeilingCutaway)}
            className="technical-btn"
            style={{
              padding: '6px 10px',
              fontSize: '10px',
              background: showCeilingCutaway ? 'rgba(125, 231, 255, 0.2)' : undefined,
            }}
            title="Toggle Roof/Ceiling Slab"
          >
            CEILING
          </button>
        </div>
      </div>

      {/* THREE.JS CANVAS CONTAINER */}
      <div
        ref={mountRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          minHeight: '520px',
          position: 'relative',
          background: '#060c16',
          overflow: 'hidden',
        }}
      />

      {/* FLOATING HUD OVERLAYS */}
      {/* 1. MOUSE NAVIGATION HINT */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          background: 'rgba(6, 12, 22, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          padding: '8px 14px',
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.7)',
          display: 'flex',
          gap: '14px',
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span>● LEFT DRAG: ORBIT 360°</span>
        <span>● RIGHT DRAG: PAN</span>
        <span>● SCROLL: ZOOM IN/OUT</span>
      </div>

      {/* 2. ROOM LEGEND PALETTE */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'rgba(6, 12, 22, 0.85)',
          border: '1px solid rgba(125, 231, 255, 0.2)',
          borderRadius: '4px',
          padding: '10px 14px',
          display: 'flex',
          gap: '12px',
          backdropFilter: 'blur(6px)',
          fontFamily: 'DM Mono, monospace',
          fontSize: '9px',
          color: '#f5f5f2',
          flexWrap: 'wrap',
          maxWidth: '500px',
        }}
      >
        <span style={{ color: '#7de7ff', fontWeight: 'bold' }}>PROGRAM:</span>
        {layout.rooms?.map((r, i) => {
          const finish = getRoomFinish(r.type || r.room || r.name)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  background: finish.accent,
                  display: 'inline-block',
                }}
              />
              <span>{r.name || r.room || r.type}</span>
            </div>
          )
        })}
      </div>

      {/* 3. WALL HEIGHT SLIDER */}
      <div
        style={{
          position: 'absolute',
          top: '65px',
          right: '20px',
          background: 'rgba(6, 12, 22, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontFamily: 'DM Mono, monospace',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span>WALL HEIGHT: {wallHeight} FT</span>
        <input
          type="range"
          min="4"
          max="12"
          step="0.5"
          value={wallHeight}
          onChange={(e) => setWallHeight(parseFloat(e.target.value))}
          style={{ width: '80px', accentColor: '#7de7ff', cursor: 'pointer' }}
        />
      </div>
    </div>
  )
}

export default FloorPlan3DViewer
