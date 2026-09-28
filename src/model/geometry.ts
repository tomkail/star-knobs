import type { ArcSeg, Vec } from '@tomkail/workshop-kit'
import type { KnobDesign } from './design'

/**
 * Knob geometry.
 *
 * Both design modes reduce to one canonical construction:
 *   a blank circle (radius R) with N holes (radius r) on a pitch circle (radius P),
 *   and a fillet (radius f) rounding each corner where a hole meets the rim.
 *
 * The outline is then a closed chain of arcs:
 *   … hole (concave) → fillet (convex) → blank rim → fillet → next hole …
 *
 * A fully "lobed" knob is the special case where the fillets grow until the
 * rim arc between them vanishes, so each lobe is a single circle.
 */

export interface Circle {
  center: Vec
  radius: number
}

export type IssueLevel = 'error' | 'warning' | 'info'

export interface Issue {
  level: IssueLevel
  code: string
  message: string
}

export interface KnobGeometry {
  valid: boolean
  issues: Issue[]
  lobes: number
  /** Canonical construction */
  blankRadius: number
  holeRadius: number
  pitchRadius: number
  tipRadius: number
  maxTipRadius: number
  /** Angle (radians, screen coords) of each hole centre */
  holeAngles: number[]
  holes: Circle[]
  /** Fillet circles, two per hole (empty if tip radius is 0) */
  fillets: Circle[]
  /** Lobe circles for lobed mode (fillets merged) */
  lobeCircles: Circle[]
  /** Outline start point and arcs, closed */
  outlineStart: Vec
  outline: ArcSeg[]
  /** Centre bore, outermost radius (for clearance checks) */
  boreRadius: number
  stats: KnobStats
}

export interface KnobStats {
  overallDiameter: number
  scallopDepth: number
  /** Diameter of the solid core inside the scallops */
  coreDiameter: number
  /** Wall between scallop bottom and bore */
  boreWall: number
  /** Straight-line distance between neighbouring hole centres (set dividers to this) */
  holeChord: number
  /** Narrowest gap between neighbouring holes; null if they overlap outside the blank */
  neckWidth: number | null
  /** Chord across the flat of each lobe tip (0 when fully lobed) */
  tipFlatWidth: number
  holeSpacingDeg: number
}

const TAU = Math.PI * 2
const EPS = 1e-9

const polar = (r: number, a: number): Vec => ({ x: r * Math.cos(a), y: r * Math.sin(a) })
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s })
const len = (a: Vec) => Math.hypot(a.x, a.y)
const angleOf = (a: Vec) => Math.atan2(a.y, a.x)

/**
 * Angle ψ (from the hole's centre line) of the fillet circle centre, for a fillet of radius f
 * that touches the blank rim from inside and the hole from outside. Returns null when it can't exist.
 * With f = 0 this is simply where the hole crosses the rim.
 */
export function filletAngle(R: number, r: number, P: number, f: number): number | null {
  const Rf = R - f
  if (Rf <= EPS || P <= EPS) return null
  const c = (Rf * Rf + P * P - (r + f) * (r + f)) / (2 * Rf * P)
  if (c > 1 || c < -1) return null
  return Math.acos(c)
}

/** Largest tip radius before neighbouring fillets meet (i.e. the fully lobed shape) */
export function maxTipRadius(R: number, r: number, P: number, N: number): number {
  const half = Math.PI / N
  const phi = filletAngle(R, r, P, 0)
  if (phi === null || phi >= half) return 0
  // ψ grows with f; bisect for ψ(f) = π/N
  const g = (f: number) => filletAngle(R, r, P, f) ?? Math.PI
  let lo = 0
  let hi = R * 0.999
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (g(mid) < half) lo = mid
    else hi = mid
  }
  return lo
}

export interface Canonical {
  N: number
  R: number
  r: number
  P: number
  f: number
  /** Angle of hole 0 */
  a0: number
  error?: Issue
}

/** Reduce either design mode to blank / hole / pitch / fillet */
export function toCanonical(design: KnobDesign): Canonical {
  const N = design.lobes
  const half = Math.PI / N
  // Lobe 0 points up (-y); holes sit between lobes
  const a0 = (design.rotation * Math.PI) / 180 - Math.PI / 2 + half

  if (design.mode === 'drilled') {
    return { N, R: design.blankDiameter / 2, r: design.holeDiameter / 2, P: design.pitchDiameter / 2, f: design.tipRadius, a0 }
  }

  const L = design.lobePitchDiameter / 2
  const rl = design.lobeDiameter / 2
  const rv = design.valleyDiameter / 2
  const s = Math.sin(half)
  const disc = (rl + rv) ** 2 - (L * s) ** 2
  if (disc < 0) {
    return {
      N,
      R: L + rl,
      r: rv,
      P: L,
      f: rl,
      a0,
      error: { level: 'error', code: 'valley-gap', message: 'The valley bit is too small to touch both neighbouring lobes. Use a bigger valley bit, bigger lobes, or more lobes.' },
    }
  }
  const v = L * Math.cos(half) + Math.sqrt(disc)
  return { N, R: L + rl, r: rv, P: v, f: rl, a0 }
}

/** Convert a design to the other mode, keeping the shape as close as possible */
export function convertMode(design: KnobDesign, mode: KnobDesign['mode']): KnobDesign {
  if (design.mode === mode) return design
  const c = toCanonical(design)
  if (mode === 'drilled') {
    return {
      ...design,
      mode,
      blankDiameter: round2(c.R * 2),
      holeDiameter: round2(c.r * 2),
      pitchDiameter: round2(c.P * 2),
      tipRadius: round2(Math.min(c.f, maxTipRadius(c.R, c.r, c.P, c.N))),
    }
  }
  // Drilled → lobed: grow the tip radius to its maximum so each lobe is one circle
  const fMax = maxTipRadius(c.R, c.r, c.P, c.N)
  const f = fMax > 0 ? fMax : Math.min(c.R * 0.3, c.r)
  return {
    ...design,
    mode,
    lobeDiameter: round2(f * 2),
    lobePitchDiameter: round2((c.R - f) * 2),
    valleyDiameter: round2(c.r * 2),
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

export function boreOuterRadius(design: KnobDesign): number {
  const { bore } = design
  switch (bore.type) {
    case 'none':
      return 0
    case 'round':
      return bore.diameter / 2
    case 'counterbore':
      return Math.max(bore.diameter, bore.recessDiameter) / 2
    case 'hex':
      return Math.max(bore.diameter / 2, bore.hexAcrossFlats / Math.sqrt(3))
  }
}

export function computeKnob(design: KnobDesign): KnobGeometry {
  const c = toCanonical(design)
  const { N, R, r, P, a0 } = c
  const half = Math.PI / N
  const issues: Issue[] = []
  if (c.error) issues.push(c.error)

  const holeAngles = Array.from({ length: N }, (_, i) => a0 + (TAU * i) / N)
  const holes = holeAngles.map((a) => ({ center: polar(P, a), radius: r }))
  const boreRadius = boreOuterRadius(design)

  // --- Validity checks -----------------------------------------------------
  // In lobe mode the "blank" is just the envelope of the lobe tips, so these only apply when drilling a blank
  if (design.mode === 'lobed') {
    // no rim checks
  } else if (P - r >= R - EPS) {
    issues.push({ level: 'error', code: 'no-cut', message: 'The holes sit outside the blank, so they don’t cut it. Move them inward or use a bigger bit.' })
  } else if (P + r <= R + EPS) {
    issues.push({ level: 'error', code: 'enclosed', message: 'The holes are fully inside the blank, so they won’t open the rim. Move them outward (larger pitch circle).' })
  }
  if (P - r <= EPS) {
    issues.push({ level: 'error', code: 'center', message: 'The holes reach past the centre of the knob. Use a smaller bit or a larger pitch circle.' })
  }

  const s = Math.sin(half)
  const holesOverlap = r > P * s
  if (holesOverlap) {
    const tIn = P * Math.cos(half) - Math.sqrt(Math.max(0, r * r - P * P * s * s))
    if (tIn < R) {
      issues.push({ level: 'error', code: 'overlap', message: 'Neighbouring holes overlap inside the blank, so there’s no lobe between them. Use a smaller bit, fewer lobes, or a larger pitch circle.' })
    }
  }

  const hasErrors = () => issues.some((i) => i.level === 'error')

  const maxTip = hasErrors() ? 0 : maxTipRadius(R, r, P, N)
  let f = Math.max(0, c.f)
  if (design.mode === 'drilled' && f > maxTip + 1e-6 && !hasErrors()) {
    issues.push({ level: 'info', code: 'tip-clamped', message: `Tip radius limited to ${maxTip.toFixed(1)} mm – any larger and the lobe tips would be fully round (switch to Lobe mode for that).` })
  }
  if (design.mode === 'drilled') f = Math.min(f, maxTip)

  if (!hasErrors() && boreRadius > 0) {
    const wall = P - r - boreRadius
    if (wall <= 0) {
      issues.push({ level: 'error', code: 'bore', message: 'The scallops break into the centre bore.' })
    } else if (wall < 4) {
      issues.push({ level: 'warning', code: 'thin-wall', message: `Only ${wall.toFixed(1)} mm of wood between the scallops and the bore – it may split. Aim for 5 mm or more.` })
    }
  }

  const neckWidth = holesOverlap ? null : 2 * P * s - 2 * r
  if (!hasErrors() && neckWidth !== null && neckWidth < 5) {
    issues.push({ level: 'warning', code: 'thin-neck', message: `Lobes are only ${neckWidth.toFixed(1)} mm wide at the neck. Short-grain lobes this thin can snap off.` })
  }

  // --- Outline ---------------------------------------------------------------
  const outline: ArcSeg[] = []
  const fillets: Circle[] = []
  const lobeCircles: Circle[] = []
  let outlineStart: Vec = polar(R, a0)
  let tipFlatWidth = 0
  const valid = !hasErrors()

  if (valid) {
    const psi = filletAngle(R, r, P, f)!
    const useFillet = f > 1e-6
    tipFlatWidth = 2 * R * Math.sin(Math.max(0, half - psi))

    // Per hole: fillet centres either side, and the tangent points on the hole
    const parts = holeAngles.map((a) => {
      const H = polar(P, a)
      const Cp = polar(R - f, a + psi)
      const Cm = polar(R - f, a - psi)
      const Thp = useFillet ? add(H, scale(sub(Cp, H), r / len(sub(Cp, H)))) : polar(R, a + psi)
      const Thm = useFillet ? add(H, scale(sub(Cm, H), r / len(sub(Cm, H)))) : polar(R, a - psi)
      return { a, H, Cp, Cm, Thp, Thm }
    })

    if (useFillet) {
      for (const p of parts) fillets.push({ center: p.Cp, radius: f }, { center: p.Cm, radius: f })
      if (design.mode === 'lobed' || half - psi < 1e-6) {
        // Cm of hole i is the lobe just before it, so lobe 0 is the one at the top
        for (const p of parts) lobeCircles.push({ center: p.Cm, radius: f })
      }
    }

    outlineStart = parts[0].Thp
    for (let i = 0; i < N; i++) {
      const cur = parts[i]
      const next = parts[(i + 1) % N]
      const nextA = cur.a + TAU / N
      if (useFillet) {
        outline.push({ type: 'arc', center: cur.Cp, radius: f, start: angleOf(sub(cur.Thp, cur.Cp)), end: cur.a + psi, ccw: false })
      }
      if (nextA - psi - (cur.a + psi) > 1e-9) {
        outline.push({ type: 'arc', center: { x: 0, y: 0 }, radius: R, start: cur.a + psi, end: nextA - psi, ccw: false })
      }
      if (useFillet) {
        outline.push({ type: 'arc', center: next.Cm, radius: f, start: nextA - psi, end: angleOf(sub(next.Thm, next.Cm)), ccw: false })
      }
      outline.push({ type: 'arc', center: next.H, radius: r, start: angleOf(sub(next.Thm, next.H)), end: angleOf(sub(next.Thp, next.H)), ccw: true })
    }
  }

  const holeChord = 2 * P * s
  return {
    valid,
    issues,
    lobes: N,
    blankRadius: R,
    holeRadius: r,
    pitchRadius: P,
    tipRadius: f,
    maxTipRadius: maxTip,
    holeAngles,
    holes,
    fillets,
    lobeCircles,
    outlineStart,
    outline,
    boreRadius,
    stats: {
      overallDiameter: 2 * R,
      scallopDepth: R - (P - r),
      coreDiameter: 2 * Math.max(0, P - r),
      boreWall: P - r - boreRadius,
      holeChord,
      neckWidth,
      tipFlatWidth,
      holeSpacingDeg: 360 / N,
    },
  }
}

/** Hexagon corner points for a hex recess, flats top and bottom */
export function hexPoints(acrossFlats: number, rotation = 0): Vec[] {
  const circumradius = acrossFlats / Math.sqrt(3)
  return Array.from({ length: 6 }, (_, i) => polar(circumradius, rotation + (i * Math.PI) / 3))
}

/** Area-based extent of everything drawn on the template (holes stick out past the blank) */
export function templateRadius(g: KnobGeometry): number {
  return Math.max(g.blankRadius, g.pitchRadius + g.holeRadius)
}
