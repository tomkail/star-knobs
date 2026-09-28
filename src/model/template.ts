import {
  composePage,
  pageArea,
  type ComposedPage,
  type PageSetup,
  formatLength,
  isStandardBit,
  approxFraction,
  textWidthMm,
  translateItems,
  type DrawItem,
  type Drawing,
  type LengthUnit,
  type StrokeStyle,
  type Vec,
} from '@tomkail/workshop-kit'
import type { KnobDesign } from './design'
import { hexPoints, templateRadius, type KnobGeometry } from './geometry'

/**
 * Printable template. Everything here is in real millimetres; the same
 * Drawing feeds print, PDF, SVG and DXF so the dimensions always match.
 */

export const STYLES = {
  outline: { stroke: '#000000', width: 0.35, fill: '#efefef', layer: 'outline' },
  blank: { stroke: '#000000', width: 0.2, dash: [3, 1.5], layer: 'blank' },
  hole: { stroke: '#000000', width: 0.2, layer: 'holes' },
  mark: { stroke: '#000000', width: 0.18, layer: 'centres' },
  bore: { stroke: '#000000', width: 0.25, layer: 'bore' },
  pitch: { stroke: '#666666', width: 0.15, dash: [4, 1, 1, 1], layer: 'construction' },
  construction: { stroke: '#999999', width: 0.12, dash: [1, 1], layer: 'construction' },
} satisfies Record<string, StrokeStyle>

export interface TemplateOptions {
  unit: LengthUnit
  labels: boolean
  construction: boolean
}

export interface PageOptions extends TemplateOptions {
  paperId: string
  landscape: boolean
  copies: number
  scaleCheck: boolean
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** Length in the chosen unit, e.g. "20 mm" or "25/32″" */
export function len(mm: number, unit: LengthUnit): string {
  return formatLength(mm, unit, { mmDecimals: 1, inDecimals: 3 })
}

/**
 * Drill sizes, named in the system the bit is actually sold in
 * (a 12 mm bit stays "12 mm" in inch mode), plus the other-system equivalent.
 */
export function bitSize(mm: number, unit: LengthUnit): string {
  const system = isStandardBit(mm)?.system ?? unit
  return system === 'mm' ? `Ø${len(mm, 'mm')} (${approxFraction(mm)})` : `Ø${len(mm, 'in')} (${len(mm, 'mm')})`
}

export function boreDescription(design: KnobDesign, unit: LengthUnit): string {
  const { bore } = design
  switch (bore.type) {
    case 'none':
      return 'No centre bore'
    case 'round':
      return `Centre hole ${bitSize(bore.diameter, unit)}`
    case 'counterbore':
      return `Centre hole ${bitSize(bore.diameter, unit)}, counterbore ${bitSize(bore.recessDiameter, unit)}`
    case 'hex': {
      const corners = (bore.hexAcrossFlats * 2) / Math.sqrt(3)
      return `Hex recess ${len(bore.hexAcrossFlats, unit)} across flats (${len(corners, unit)} across corners), ${bitSize(bore.diameter, unit)} through`
    }
  }
}

/** Human-readable spec lines, shared by the panel and the printed template */
export function specLines(design: KnobDesign, g: KnobGeometry, unit: LengthUnit): string[] {
  const N = g.lobes
  const deg = `${Math.round(g.stats.holeSpacingDeg * 100) / 100}°`
  const holeLine = `Drill ${N} × ${bitSize(g.holeRadius * 2, unit)} with centres on a ${len(g.pitchRadius * 2, unit)} circle, ${deg} apart (step-off ${len(g.stats.holeChord, unit)})`
  const lines: string[] = []
  if (design.mode === 'drilled') {
    lines.push(`Blank Ø${len(g.blankRadius * 2, unit)} · ${N} lobes · tip radius ${g.tipRadius > 0 ? len(g.tipRadius, unit) : 'sharp'}`)
    lines.push(holeLine)
  } else {
    lines.push(`${N} lobes, Ø${len(design.lobeDiameter, unit)} on a ${len(design.lobePitchDiameter, unit)} circle · overall Ø${len(g.blankRadius * 2, unit)}`)
    lines.push(`Valleys: ${holeLine.charAt(0).toLowerCase()}${holeLine.slice(1)}`)
  }
  lines.push(boreDescription(design, unit))
  return lines
}

export function workflowLines(design: KnobDesign): string[] {
  return design.mode === 'drilled'
    ? [
        '1. Stick this template to square stock. 2. Drill the scallop holes first, while the stock is still square and supported.',
        '3. Drill the centre bore/recess. 4. Cut the blank circle on the dashed line, then round the tips to the line on a disc sander or with a file.',
      ]
    : [
        '1. Stick this template to square stock. 2. Drill the valley holes first, while the stock is still square and supported.',
        '3. Drill the centre bore/recess. 4. Saw round the lobes, then sand to the outline.',
      ]
}

// ---------------------------------------------------------------------------
// Geometry → items (knob centred on the origin)
// ---------------------------------------------------------------------------

function crosshair(at: Vec, arm: number, style: StrokeStyle): DrawItem[] {
  return [
    { kind: 'line', from: { x: at.x - arm, y: at.y }, to: { x: at.x + arm, y: at.y }, style },
    { kind: 'line', from: { x: at.x, y: at.y - arm }, to: { x: at.x, y: at.y + arm }, style },
  ]
}

export function knobItems(design: KnobDesign, g: KnobGeometry, options: Pick<TemplateOptions, 'construction'>): DrawItem[] {
  const items: DrawItem[] = []
  const origin = { x: 0, y: 0 }

  if (options.construction) {
    items.push({ kind: 'circle', center: origin, radius: g.pitchRadius, style: STYLES.pitch })
    for (const hole of g.holes) items.push({ kind: 'line', from: origin, to: hole.center, style: STYLES.construction })
    for (const lobe of g.lobeCircles) items.push({ kind: 'circle', center: lobe.center, radius: lobe.radius, style: STYLES.construction })
  }

  if (g.valid) {
    items.push({ kind: 'path', start: g.outlineStart, segments: g.outline, closed: true, style: STYLES.outline })
  }
  if (design.mode === 'drilled') {
    items.push({ kind: 'circle', center: origin, radius: g.blankRadius, style: STYLES.blank })
  }

  for (const hole of g.holes) {
    items.push({ kind: 'circle', center: hole.center, radius: hole.radius, style: STYLES.hole })
    items.push(...crosshair(hole.center, Math.min(3, hole.radius * 0.5), STYLES.mark))
  }

  // Centre and bore
  items.push(...crosshair(origin, Math.min(4, g.blankRadius * 0.2), STYLES.mark))
  const { bore } = design
  if (bore.type !== 'none' && bore.diameter > 0) {
    items.push({ kind: 'circle', center: origin, radius: bore.diameter / 2, style: STYLES.bore })
  }
  if (bore.type === 'counterbore' && bore.recessDiameter > 0) {
    items.push({ kind: 'circle', center: origin, radius: bore.recessDiameter / 2, style: STYLES.bore })
  }
  if (bore.type === 'hex' && bore.hexAcrossFlats > 0) {
    // Flats parallel to the first lobe
    const pts = hexPoints(bore.hexAcrossFlats, (design.rotation * Math.PI) / 180)
    items.push({
      kind: 'path',
      start: pts[0],
      segments: pts.slice(1).map((to) => ({ type: 'line' as const, to })),
      closed: true,
      style: STYLES.bore,
    })
  }
  return items
}

// ---------------------------------------------------------------------------
// Single knob artboard (SVG / DXF export)
// ---------------------------------------------------------------------------

const TEXT_SIZE = 2.8
const LINE_GAP = 4.2

export function buildKnobDrawing(design: KnobDesign, g: KnobGeometry, options: TemplateOptions): { drawing: Drawing; center: Vec } {
  const margin = 5
  const extent = templateRadius(g) + 1
  const lines = options.labels ? [design.name, ...specLines(design, g, options.unit)] : []
  const textWidth = Math.max(0, ...lines.map((l, i) => textWidthMm(l, i === 0 ? 3.4 : TEXT_SIZE, i === 0)))
  const width = Math.max(extent * 2, textWidth) + margin * 2
  const labelHeight = lines.length ? lines.length * LINE_GAP + 3 : 0
  const height = extent * 2 + margin * 2 + labelHeight
  const center = { x: width / 2, y: margin + extent }

  const items = translateItems(knobItems(design, g, options), center.x, center.y)
  lines.forEach((text, i) => {
    items.push({
      kind: 'text',
      at: { x: width / 2, y: margin + extent * 2 + 5 + i * LINE_GAP },
      text,
      size: i === 0 ? 3.4 : TEXT_SIZE,
      bold: i === 0,
      align: 'middle',
      layer: 'labels',
    })
  })
  return { drawing: { width: round(width), height: round(height), items }, center }
}

const round = (v: number) => Math.round(v * 100) / 100

// ---------------------------------------------------------------------------
// Printable page (layout, header and rulers come from workshop-kit)
// ---------------------------------------------------------------------------

export interface PageLayout {
  cols: number
  rows: number
  maxCopies: number
  cell: number
  fits: boolean
}

const CELL_GAP = 4

function pageSetup(design: KnobDesign, g: KnobGeometry, options: PageOptions): PageSetup {
  return {
    paperId: options.paperId,
    landscape: options.landscape,
    scaleCheck: options.scaleCheck,
    header: options.labels
      ? { title: design.name, tag: 'Star Knobs template · 1:1', lines: specLines(design, g, options.unit), notes: workflowLines(design) }
      : undefined,
  }
}

export function pageLayout(design: KnobDesign, g: KnobGeometry, options: PageOptions): PageLayout {
  const { area } = pageArea(pageSetup(design, g, options))
  const cell = (templateRadius(g) + 1.5) * 2
  const cols = Math.max(0, Math.floor((area.width + CELL_GAP) / (cell + CELL_GAP)))
  const rows = Math.max(0, Math.floor((area.height + CELL_GAP) / (cell + CELL_GAP)))
  return { cols, rows, maxCopies: cols * rows, cell, fits: cols * rows > 0 }
}

export function buildPage(design: KnobDesign, g: KnobGeometry, options: PageOptions): ComposedPage & { layout: PageLayout } {
  const layout = pageLayout(design, g, options)
  const { cell } = layout
  const copies = layout.fits ? Math.max(1, Math.min(options.copies, layout.maxCopies)) : 1
  const cols = layout.fits ? Math.min(layout.cols, copies) : 1
  const rows = Math.ceil(copies / cols)

  const knob = knobItems(design, g, options)
  const items: DrawItem[] = []
  for (let i = 0; i < copies; i++) {
    const cx = (i % cols) * (cell + CELL_GAP) + cell / 2
    const cy = Math.floor(i / cols) * (cell + CELL_GAP) + cell / 2
    items.push(...translateItems(knob, cx, cy))
  }
  const bounds = { x: 0, y: 0, width: cols * cell + (cols - 1) * CELL_GAP, height: rows * cell + (rows - 1) * CELL_GAP }

  // Star Knobs works in mm, so content is placed at true size
  const page = composePage({ items, bounds }, pageSetup(design, g, options), { mode: 'physical', mmPerUnit: 1 })
  return { ...page, layout }
}
