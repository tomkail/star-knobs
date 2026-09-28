import { useEffect, useMemo, useRef, useState } from 'react'
import {
  hexToRgba,
  nearestBit,
  renderGrid,
  snapLength,
  tracePath,
  useViewportCanvas,
  type CanvasTheme,
  type PointerInfo,
  type Vec,
} from '@tomkail/workshop-kit'
import { useDesignStore } from '../stores/designStore'
import { useSettingsStore, useThemeStore, useViewportStore } from '../stores/settingsStore'
import { computeKnob, hexPoints, templateRadius, type KnobGeometry } from '../model/geometry'
import type { KnobDesign } from '../model/design'
import { bitSize, len } from '../model/template'
import { canvasSize, fitView } from '../actions'
import styles from './KnobCanvas.module.css'

type HandleId = 'pitch' | 'hole' | 'blank' | 'lobePitch' | 'lobe' | 'valley'

interface Handle {
  id: HandleId
  pos: Vec
  shape: 'dot' | 'ring' | 'diamond'
  label: string
}

const polar = (r: number, a: number): Vec => ({ x: r * Math.cos(a), y: r * Math.sin(a) })
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
const DEG = 180 / Math.PI

function lobeAngle(design: KnobDesign) {
  return (design.rotation / DEG) - Math.PI / 2
}

function computeHandles(design: KnobDesign, g: KnobGeometry, unit: 'mm' | 'in'): Handle[] {
  const a0 = g.holeAngles[0]
  const H0 = g.holes[0].center
  const holeEdge = { x: H0.x + g.holeRadius * Math.cos(a0), y: H0.y + g.holeRadius * Math.sin(a0) }
  const la = lobeAngle(design)
  if (design.mode === 'drilled') {
    return [
      { id: 'blank', pos: polar(g.blankRadius, la), shape: 'diamond', label: `Blank Ø${len(g.blankRadius * 2, unit)}` },
      { id: 'hole', pos: holeEdge, shape: 'ring', label: `Bit ${bitSize(g.holeRadius * 2, unit)}` },
      { id: 'pitch', pos: H0, shape: 'dot', label: `Pitch Ø${len(g.pitchRadius * 2, unit)} · ${Math.round(design.rotation)}°` },
    ]
  }
  const lobeCenter = polar(design.lobePitchDiameter / 2, la)
  return [
    { id: 'lobe', pos: polar(design.lobePitchDiameter / 2 + design.lobeDiameter / 2, la), shape: 'diamond', label: `Lobe Ø${len(design.lobeDiameter, unit)}` },
    { id: 'valley', pos: holeEdge, shape: 'ring', label: `Valley bit ${bitSize(g.holeRadius * 2, unit)}` },
    { id: 'lobePitch', pos: lobeCenter, shape: 'dot', label: `Lobe pitch Ø${len(design.lobePitchDiameter, unit)} · ${Math.round(design.rotation)}°` },
  ]
}

function normaliseDegrees(deg: number) {
  const d = ((deg % 360) + 540) % 360 - 180
  return Math.abs(d + 180) < 1e-9 ? 180 : d
}

function dragUpdate(id: HandleId, info: PointerInfo, design: KnobDesign, g: KnobGeometry): Partial<KnobDesign> {
  const { unit, snap, snapToBits } = useSettingsStore.getState()
  const free = info.shift || !snap
  const lengthStep = unit === 'mm' ? 0.5 : 1 / 32
  const snapLen = (mm: number) => (free ? Math.round(mm * 100) / 100 : snapLength(mm, unit, lengthStep))
  const snapBit = (mm: number) => (snapToBits && !info.shift ? nearestBit(mm, unit).diameter : snapLen(mm))
  const w = info.world
  const radius = Math.hypot(w.x, w.y)
  const angle = Math.atan2(w.y, w.x)
  const snapAngle = (deg: number) => normaliseDegrees(free ? Math.round(deg * 10) / 10 : Math.round(deg / 15) * 15)

  switch (id) {
    case 'blank':
      return { blankDiameter: Math.max(2, snapLen(radius * 2)) }
    case 'pitch':
      return { pitchDiameter: Math.max(1, snapLen(radius * 2)), rotation: snapAngle((angle + Math.PI / 2 - Math.PI / g.lobes) * DEG) }
    case 'hole':
      return { holeDiameter: Math.max(1, snapBit(dist(w, g.holes[0].center) * 2)) }
    case 'lobePitch':
      return { lobePitchDiameter: Math.max(1, snapLen(radius * 2)), rotation: snapAngle((angle + Math.PI / 2) * DEG) }
    case 'lobe':
      return { lobeDiameter: Math.max(1, snapLen(dist(w, polar(design.lobePitchDiameter / 2, lobeAngle(design))) * 2)) }
    case 'valley':
      return { valleyDiameter: Math.max(1, snapBit(dist(w, g.holes[0].center) * 2)) }
  }
}

export function KnobCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const design = useDesignStore((s) => s.design)
  const update = useDesignStore((s) => s.update)
  const theme = useThemeStore((s) => s.theme)
  const pan = useViewportStore((s) => s.pan)
  const zoom = useViewportStore((s) => s.zoom)
  const unit = useSettingsStore((s) => s.unit)
  const showConstruction = useSettingsStore((s) => s.showConstruction)
  const showMeasurements = useSettingsStore((s) => s.showMeasurements)

  const geometry = useMemo(() => computeKnob(design), [design])
  const handles = useMemo(() => computeHandles(design, geometry, unit), [design, geometry, unit])
  const [hovered, setHovered] = useState<HandleId | null>(null)
  const [dragging, setDragging] = useState<HandleId | null>(null)
  const draggingRef = useRef<HandleId | null>(null)

  const latest = useRef({ design, geometry, handles })
  latest.current = { design, geometry, handles }

  const hitTest = (info: PointerInfo): HandleId | null => {
    const tolerance = (matchMedia('(pointer: coarse)').matches ? 22 : 12) / useViewportStore.getState().zoom
    let best: { id: HandleId; d: number } | null = null
    for (const h of latest.current.handles) {
      const d = dist(h.pos, info.world)
      if (d < tolerance && (!best || d < best.d)) best = { id: h.id, d }
    }
    return best?.id ?? null
  }

  const size = useViewportCanvas(canvasRef, useViewportStore, {
    onPointerDown: (info) => {
      const id = hitTest(info)
      if (!id) return false
      draggingRef.current = id
      setDragging(id)
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
      return true
    },
    onDrag: (info) => {
      const id = draggingRef.current
      if (id) update(dragUpdate(id, info, latest.current.design, latest.current.geometry))
    },
    onDragEnd: (info) => {
      draggingRef.current = null
      setDragging(null)
      const id = hitTest(info)
      setHovered(id)
      if (canvasRef.current) canvasRef.current.style.cursor = id ? 'grab' : ''
    },
    onHover: (info) => {
      const id = info ? hitTest(info) : null
      setHovered(id)
      if (canvasRef.current) canvasRef.current.style.cursor = id ? 'grab' : ''
    },
  })

  // Keep the shared canvas size current and fit the knob on first layout
  const fitted = useRef(false)
  useEffect(() => {
    canvasSize.width = size.width
    canvasSize.height = size.height
    if (!fitted.current && size.width > 0 && size.height > 0) {
      fitted.current = true
      fitView()
    }
  }, [size.width, size.height])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx || size.width === 0) return
      draw(ctx, {
        canvas,
        dpr: size.dpr,
        pan,
        zoom,
        theme,
        design,
        g: geometry,
        handles,
        active: dragging ?? hovered,
        dragging: dragging !== null,
        unit,
        showConstruction,
        showMeasurements,
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [size, pan, zoom, theme, design, geometry, handles, hovered, dragging, unit, showConstruction, showMeasurements])

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Star knob design canvas. Drag the handles to change the pitch circle, bit size and blank." />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

interface DrawContext {
  canvas: HTMLCanvasElement
  dpr: number
  pan: Vec
  zoom: number
  theme: CanvasTheme
  design: KnobDesign
  g: KnobGeometry
  handles: Handle[]
  active: HandleId | null
  dragging: boolean
  unit: 'mm' | 'in'
  showConstruction: boolean
  showMeasurements: boolean
}

function draw(ctx: CanvasRenderingContext2D, d: DrawContext) {
  const { canvas, dpr, pan, zoom, theme, design, g, unit } = d
  const px = 1 / zoom

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = theme.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  renderGrid(ctx, canvas.width, canvas.height, pan, zoom, {
    baseSize: unit === 'mm' ? 1 : 25.4 / 16,
    levelMultiplier: unit === 'mm' ? 10 : 4,
    color: theme.gridColor,
    idealScreenSpacing: 24,
  })

  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * pan.x, dpr * pan.y)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const circle = (c: Vec, r: number) => {
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  }
  const cross = (c: Vec, arm: number) => {
    ctx.beginPath()
    ctx.moveTo(c.x - arm, c.y)
    ctx.lineTo(c.x + arm, c.y)
    ctx.moveTo(c.x, c.y - arm)
    ctx.lineTo(c.x, c.y + arm)
    ctx.stroke()
  }
  const origin = { x: 0, y: 0 }
  const isActive = (...ids: HandleId[]) => d.active !== null && ids.includes(d.active)

  // Construction lines
  if (d.showConstruction) {
    ctx.lineWidth = px
    ctx.strokeStyle = isActive('pitch', 'lobePitch') ? theme.accent : theme.stroke
    ctx.setLineDash([10 * px, 4 * px, 2 * px, 4 * px])
    circle(origin, g.pitchRadius)
    ctx.stroke()
    if (design.mode === 'lobed') {
      circle(origin, design.lobePitchDiameter / 2)
      ctx.stroke()
    }
    ctx.setLineDash([2 * px, 4 * px])
    ctx.strokeStyle = theme.chrome
    for (const hole of g.holes) {
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(hole.center.x, hole.center.y)
      ctx.stroke()
    }
    ctx.strokeStyle = isActive('lobe') ? theme.accent : theme.accentGhost
    for (const c of design.mode === 'lobed' ? g.lobeCircles : g.fillets) {
      circle(c.center, c.radius)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  // Blank circle (the saw line in drilled mode)
  if (design.mode === 'drilled') {
    ctx.lineWidth = (isActive('blank') ? 2 : 1.25) * px
    ctx.strokeStyle = !g.valid ? theme.danger : isActive('blank') ? theme.accent : theme.strokeHover
    ctx.setLineDash([6 * px, 4 * px])
    circle(origin, g.blankRadius)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Knob body
  if (g.valid) {
    ctx.beginPath()
    tracePath(ctx, { start: g.outlineStart, segments: g.outline, closed: true })
    ctx.fillStyle = hexToRgba(theme.accent, theme.isDark ? 0.14 : 0.18)
    ctx.fill()
    ctx.lineWidth = 2 * px
    ctx.strokeStyle = theme.pathStroke
    ctx.stroke()
  }

  // Drill holes
  ctx.lineWidth = (isActive('hole', 'valley') ? 2 : 1.25) * px
  ctx.strokeStyle = !g.valid ? theme.danger : isActive('hole', 'valley') ? theme.accent : theme.strokeHover
  for (const hole of g.holes) {
    circle(hole.center, hole.radius)
    ctx.stroke()
  }
  ctx.lineWidth = px
  ctx.strokeStyle = theme.strokeHover
  for (const hole of g.holes) cross(hole.center, 5 * px)

  // Bore
  ctx.lineWidth = 1.25 * px
  ctx.strokeStyle = g.valid ? theme.strokeHover : theme.danger
  const { bore } = design
  if (bore.type !== 'none' && bore.diameter > 0) {
    circle(origin, bore.diameter / 2)
    ctx.stroke()
  }
  if (bore.type === 'counterbore' && bore.recessDiameter > 0) {
    circle(origin, bore.recessDiameter / 2)
    ctx.stroke()
  }
  if (bore.type === 'hex' && bore.hexAcrossFlats > 0) {
    const pts = hexPoints(bore.hexAcrossFlats, design.rotation / DEG)
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.stroke()
  }
  ctx.lineWidth = px
  cross(origin, 7 * px)

  // Measurements, drawn in screen space for constant size
  if (d.showMeasurements) drawMeasurements(ctx, d)

  // Handles
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  for (const handle of d.handles) {
    const s = { x: handle.pos.x * zoom + pan.x, y: handle.pos.y * zoom + pan.y }
    drawHandle(ctx, s, handle.shape, handle.id === d.active, theme)
  }
  const active = d.handles.find((h) => h.id === d.active)
  if (active) {
    const s = { x: active.pos.x * zoom + pan.x, y: active.pos.y * zoom + pan.y }
    pill(ctx, active.label, { x: s.x, y: s.y - 20 }, theme, true)
  }
}

function drawHandle(ctx: CanvasRenderingContext2D, at: Vec, shape: Handle['shape'], active: boolean, theme: CanvasTheme) {
  const size = active ? 7 : 5.5
  const path = new Path2D()
  if (shape === 'diamond') {
    path.moveTo(at.x, at.y - size * 1.25)
    path.lineTo(at.x + size * 1.25, at.y)
    path.lineTo(at.x, at.y + size * 1.25)
    path.lineTo(at.x - size * 1.25, at.y)
    path.closePath()
  } else {
    path.arc(at.x, at.y, size, 0, Math.PI * 2)
  }
  // Double stroke (Serpentine visual language): light halo, dark outline, accent body
  ctx.lineWidth = theme.handle.innerWidth + theme.handle.outerWidth * 2
  ctx.strokeStyle = theme.handle.outerStroke
  ctx.stroke(path)
  ctx.lineWidth = theme.handle.innerWidth
  ctx.strokeStyle = theme.handle.innerStroke
  ctx.stroke(path)
  if (shape === 'ring') {
    ctx.fillStyle = theme.background
    ctx.fill(path)
    ctx.lineWidth = 2
    ctx.strokeStyle = theme.accent
    ctx.stroke(path)
  } else {
    ctx.fillStyle = active ? theme.accent : hexToRgba(theme.accent, 0.85)
    ctx.fill(path)
  }
}

function pill(ctx: CanvasRenderingContext2D, text: string, at: Vec, theme: CanvasTheme, accent = false) {
  ctx.font = `500 11px 'JetBrains Mono', ui-monospace, monospace`
  const w = ctx.measureText(text).width + 12
  const h = 18
  ctx.beginPath()
  ctx.roundRect(at.x - w / 2, at.y - h / 2, w, h, 4)
  ctx.fillStyle = theme.ui.panelBg
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = accent ? theme.accentDim : theme.ui.panelBorder
  ctx.stroke()
  ctx.fillStyle = accent ? theme.accent : theme.ui.textSecondary
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, at.x, at.y + 0.5)
}

function drawMeasurements(ctx: CanvasRenderingContext2D, d: DrawContext) {
  const { dpr, pan, zoom, theme, g, design, unit } = d
  if (zoom * g.blankRadius < 40) return // too small to label legibly
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const S = (p: Vec): Vec => ({ x: p.x * zoom + pan.x, y: p.y * zoom + pan.y })
  const extent = templateRadius(g)

  const dimension = (r: number, y: number, label: string) => {
    const a = S({ x: -r, y: 0 })
    const b = S({ x: r, y: 0 })
    ctx.lineWidth = 1
    ctx.strokeStyle = theme.chrome
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(a.x, y)
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = theme.strokeHover
    ctx.beginPath()
    ctx.moveTo(a.x, y)
    ctx.lineTo(b.x, y)
    // Arrow ticks
    for (const [x, dir] of [[a.x, 1], [b.x, -1]] as const) {
      ctx.moveTo(x + dir * 7, y - 4)
      ctx.lineTo(x, y)
      ctx.lineTo(x + dir * 7, y + 4)
    }
    ctx.stroke()
    pill(ctx, label, { x: (a.x + b.x) / 2, y }, theme)
  }

  const bottom = S({ x: 0, y: extent }).y + 26
  const top = S({ x: 0, y: -extent }).y - 26
  if (design.mode === 'drilled') dimension(g.blankRadius, bottom, `Blank Ø${len(g.blankRadius * 2, unit)}`)
  else dimension(g.blankRadius, bottom, `Overall Ø${len(g.blankRadius * 2, unit)}`)
  dimension(g.pitchRadius, top, `${design.mode === 'lobed' ? 'Valley pitch' : 'Pitch'} Ø${len(g.pitchRadius * 2, unit)}`)

  // Bit size inside each... just the first hole, to keep it calm
  const h0 = S(g.holes[0].center)
  if (g.holeRadius * zoom > 22) pill(ctx, `Ø${len(g.holeRadius * 2, unit)}`, { x: h0.x, y: h0.y + 16 }, theme)

  // Tip radius at the corner beside the first lobe (lobe mode shows lobe size on its handle)
  if (design.mode === 'drilled' && g.valid && g.tipRadius > 0 && g.fillets.length) {
    const c = g.fillets[1]
    const dir = Math.atan2(c.center.y, c.center.x)
    const p = S({ x: c.center.x + Math.cos(dir) * c.radius, y: c.center.y + Math.sin(dir) * c.radius })
    pill(ctx, `R${len(c.radius, unit)}`, { x: p.x + Math.cos(dir) * 28, y: p.y + Math.sin(dir) * 16 }, theme)
  }
}
