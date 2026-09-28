import { describe, expect, it } from 'vitest'
import { arcPoint, arcSweep, drawingToDxf, drawingToSvg, drawingsToPdf } from '@tomkail/workshop-kit'
import { DEFAULT_DESIGN, designFromQuery, designToQuery, type KnobDesign } from './design'
import { computeKnob, convertMode, maxTipRadius, toCanonical } from './geometry'
import { PRESETS } from './presets'
import { buildPage, buildKnobDrawing } from './template'

function checkOutline(design: KnobDesign, smooth = true) {
  const g = computeKnob(design)
  expect(g.valid, JSON.stringify(g.issues)).toBe(true)
  let current = g.outlineStart
  let totalTurn = 0
  for (const seg of g.outline) {
    const start = arcPoint(seg.center, seg.radius, seg.start)
    expect(Math.hypot(start.x - current.x, start.y - current.y)).toBeLessThan(1e-6)
    const sweep = arcSweep(seg)
    // No arc should wrap more than a half turn in these shapes
    expect(Math.abs(sweep)).toBeLessThan(Math.PI * 1.5)
    totalTurn += sweep
    current = arcPoint(seg.center, seg.radius, seg.start + sweep)
  }
  expect(Math.hypot(current.x - g.outlineStart.x, current.y - g.outlineStart.y)).toBeLessThan(1e-6)
  // A smooth simple closed curve turns through exactly one full revolution
  if (smooth) expect(Math.abs(totalTurn - Math.PI * 2)).toBeLessThan(1e-6)
  return g
}

describe('knob geometry', () => {
  it('builds a closed, tangent-continuous outline for the default design', () => {
    const g = checkOutline(DEFAULT_DESIGN)
    expect(g.outline.length).toBe(DEFAULT_DESIGN.lobes * 4)
    expect(g.stats.scallopDepth).toBeCloseTo(30 - (31 - 10))
  })

  it('handles sharp tips (no fillet)', () => {
    const g = checkOutline({ ...DEFAULT_DESIGN, tipRadius: 0 }, false)
    expect(g.outline.length).toBe(DEFAULT_DESIGN.lobes * 2)
  })

  it('clamps the tip radius to the fully-lobed maximum', () => {
    const g = checkOutline({ ...DEFAULT_DESIGN, tipRadius: 100 })
    expect(g.tipRadius).toBeCloseTo(maxTipRadius(30, 10, 31, 5), 6)
    expect(g.issues.some((i) => i.code === 'tip-clamped')).toBe(true)
  })

  it('every preset is valid', () => {
    for (const preset of PRESETS) checkOutline(preset.design)
  })

  it('lobed mode gives lobes tangent to the valley holes', () => {
    const design: KnobDesign = { ...DEFAULT_DESIGN, mode: 'lobed', lobes: 6, lobeDiameter: 14, lobePitchDiameter: 50, valleyDiameter: 16 }
    const g = checkOutline(design)
    expect(g.lobeCircles).toHaveLength(6)
    for (const lobe of g.lobeCircles) {
      expect(Math.hypot(lobe.center.x, lobe.center.y)).toBeCloseTo(25)
      for (const hole of g.holes) {
        const d = Math.hypot(lobe.center.x - hole.center.x, lobe.center.y - hole.center.y)
        expect(d).toBeGreaterThan(7 + 8 - 1e-6)
      }
    }
    // First lobe points straight up
    expect(g.lobeCircles[0].center.x).toBeCloseTo(0)
    expect(g.lobeCircles[0].center.y).toBeCloseTo(-25)
  })

  it('round-trips between modes without changing the shape much', () => {
    const lobed = convertMode({ ...DEFAULT_DESIGN, tipRadius: 100 }, 'lobed')
    const a = toCanonical({ ...DEFAULT_DESIGN, tipRadius: maxTipRadius(30, 10, 31, 5) })
    const b = toCanonical(lobed)
    expect(b.R).toBeCloseTo(a.R, 1)
    expect(b.P).toBeCloseTo(a.P, 1)
    expect(b.r).toBeCloseTo(a.r, 1)
  })

  it('flags overlapping holes', () => {
    const g = computeKnob({ ...DEFAULT_DESIGN, lobes: 8, holeDiameter: 30 })
    expect(g.valid).toBe(false)
    expect(g.issues.some((i) => i.code === 'overlap')).toBe(true)
  })

  it('flags holes that miss or are enclosed by the blank', () => {
    expect(computeKnob({ ...DEFAULT_DESIGN, pitchDiameter: 110 }).issues.some((i) => i.code === 'no-cut')).toBe(true)
    expect(computeKnob({ ...DEFAULT_DESIGN, pitchDiameter: 30 }).issues.some((i) => i.code === 'enclosed')).toBe(true)
  })

  it('round-trips through the share URL', () => {
    const back = designFromQuery(designToQuery(DEFAULT_DESIGN))!
    expect(back).toEqual(DEFAULT_DESIGN)
  })
})

describe('template output', () => {
  it('writes an SVG with physical mm dimensions', () => {
    const { drawing } = buildKnobDrawing(DEFAULT_DESIGN, computeKnob(DEFAULT_DESIGN), { unit: 'mm', labels: true, construction: true })
    const svg = drawingToSvg(drawing)
    expect(svg).toMatch(new RegExp(`width="${drawing.width}mm"`))
    expect(svg).toContain('<path d="M')
  })

  it('lays out a page with a scale check and valid PDF/DXF', () => {
    const page = buildPage(DEFAULT_DESIGN, computeKnob(DEFAULT_DESIGN), { paperId: 'a4', landscape: false, copies: 4, unit: 'mm', labels: true, construction: true, scaleCheck: true })
    expect(page.width).toBe(210)
    expect(page.height).toBe(297)
    expect(page.items.some((i) => i.kind === 'text' && i.text.includes('Print scale check'))).toBe(true)
    const pdf = new TextDecoder('latin1').decode(drawingsToPdf([page]))
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('/MediaBox [0 0 595.276 841.89]')
    const dxf = drawingToDxf(page)
    expect(dxf).toContain('\nARC\n')
    expect(dxf.trim().endsWith('EOF')).toBe(true)
  })
})
