/**
 * The star knob design document. All lengths are millimetres, angles degrees.
 *
 * There are two ways to specify the same family of shapes:
 *
 * - "drilled": start from a round blank and drill N holes whose centres sit on
 *   a pitch circle just outside/at the rim. The holes scallop the edge; the
 *   wood left between them becomes the lobes. Tip radius rounds the corners.
 *
 * - "lobed": start from N lobe circles on a pitch circle and join neighbours
 *   with a concave valley arc. The valley arc is still a drilled hole, so the
 *   template still gives a drilling schedule; lobes are then shaped to the line.
 */

export type DesignMode = 'drilled' | 'lobed'
export type BoreType = 'none' | 'round' | 'counterbore' | 'hex'

export interface BoreSpec {
  type: BoreType
  /** Through-hole diameter */
  diameter: number
  /** Counterbore diameter (type 'counterbore') */
  recessDiameter: number
  /** Hex recess size across flats (type 'hex') */
  hexAcrossFlats: number
}

export interface KnobDesign {
  version: 1
  name: string
  mode: DesignMode
  lobes: number
  /** 0 = a lobe points straight up; positive rotates clockwise */
  rotation: number

  // Drilled mode
  blankDiameter: number
  holeDiameter: number
  pitchDiameter: number
  tipRadius: number

  // Lobed mode
  lobeDiameter: number
  lobePitchDiameter: number
  valleyDiameter: number

  bore: BoreSpec
}

export const MIN_LOBES = 2
export const MAX_LOBES = 24

export const DEFAULT_DESIGN: KnobDesign = {
  version: 1,
  name: 'Five-lobe jig knob',
  mode: 'drilled',
  lobes: 5,
  rotation: 0,
  blankDiameter: 60,
  holeDiameter: 20,
  pitchDiameter: 62,
  tipRadius: 3,
  lobeDiameter: 16,
  lobePitchDiameter: 44,
  valleyDiameter: 20,
  bore: { type: 'hex', diameter: 8.5, recessDiameter: 20, hexAcrossFlats: 13 },
}

export interface HardwarePreset {
  id: string
  label: string
  bore: BoreSpec
}

const IN = 25.4

/** Typical sizes – always check against your actual hardware */
export const HARDWARE_PRESETS: HardwarePreset[] = [
  { id: 'm6-hex', label: 'M6 bolt, hex head (10 mm AF)', bore: { type: 'hex', diameter: 6.5, recessDiameter: 0, hexAcrossFlats: 10 } },
  { id: 'm8-hex', label: 'M8 bolt, hex head (13 mm AF)', bore: { type: 'hex', diameter: 8.5, recessDiameter: 0, hexAcrossFlats: 13 } },
  { id: 'm10-hex', label: 'M10 bolt, hex head (17 mm AF)', bore: { type: 'hex', diameter: 10.5, recessDiameter: 0, hexAcrossFlats: 17 } },
  { id: '1/4-hex', label: '1/4-20 bolt, hex head (7/16″ AF)', bore: { type: 'hex', diameter: (17 / 64) * IN, recessDiameter: 0, hexAcrossFlats: (7 / 16) * IN } },
  { id: '5/16-hex', label: '5/16-18 bolt, hex head (1/2″ AF)', bore: { type: 'hex', diameter: (21 / 64) * IN, recessDiameter: 0, hexAcrossFlats: 0.5 * IN } },
  { id: '3/8-hex', label: '3/8-16 bolt, hex head (9/16″ AF)', bore: { type: 'hex', diameter: (25 / 64) * IN, recessDiameter: 0, hexAcrossFlats: (9 / 16) * IN } },
  { id: 'm6-insert', label: 'M6 threaded insert (≈ 8 mm hole)', bore: { type: 'round', diameter: 8, recessDiameter: 0, hexAcrossFlats: 0 } },
  { id: 'm8-insert', label: 'M8 threaded insert (≈ 10 mm hole)', bore: { type: 'round', diameter: 10, recessDiameter: 0, hexAcrossFlats: 0 } },
  { id: '1/4-insert', label: '1/4-20 threaded insert (≈ 3/8″ hole)', bore: { type: 'round', diameter: 0.375 * IN, recessDiameter: 0, hexAcrossFlats: 0 } },
  { id: 'm8-tnut', label: 'M8 T-nut (10 mm hole, 24 mm flange)', bore: { type: 'counterbore', diameter: 10, recessDiameter: 24, hexAcrossFlats: 0 } },
]

export function clampLobes(n: number): number {
  return Math.max(MIN_LOBES, Math.min(MAX_LOBES, Math.round(n)))
}

export type DesignInput = Partial<Omit<KnobDesign, 'bore'>> & { bore?: Partial<BoreSpec> }

/** Normalise a (possibly partial / older) design loaded from storage, a file or a URL */
export function normaliseDesign(input: DesignInput | null | undefined): KnobDesign {
  const d = { ...DEFAULT_DESIGN, ...(input ?? {}), bore: { ...DEFAULT_DESIGN.bore, ...(input?.bore ?? {}) } }
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  return {
    version: 1,
    name: typeof d.name === 'string' ? d.name.slice(0, 80) : DEFAULT_DESIGN.name,
    mode: d.mode === 'lobed' ? 'lobed' : 'drilled',
    lobes: clampLobes(num(d.lobes, DEFAULT_DESIGN.lobes)),
    rotation: num(d.rotation, 0),
    blankDiameter: Math.max(1, num(d.blankDiameter, DEFAULT_DESIGN.blankDiameter)),
    holeDiameter: Math.max(0.5, num(d.holeDiameter, DEFAULT_DESIGN.holeDiameter)),
    pitchDiameter: Math.max(0.5, num(d.pitchDiameter, DEFAULT_DESIGN.pitchDiameter)),
    tipRadius: Math.max(0, num(d.tipRadius, DEFAULT_DESIGN.tipRadius)),
    lobeDiameter: Math.max(0.5, num(d.lobeDiameter, DEFAULT_DESIGN.lobeDiameter)),
    lobePitchDiameter: Math.max(0.5, num(d.lobePitchDiameter, DEFAULT_DESIGN.lobePitchDiameter)),
    valleyDiameter: Math.max(0.5, num(d.valleyDiameter, DEFAULT_DESIGN.valleyDiameter)),
    bore: {
      type: (['none', 'round', 'counterbore', 'hex'] as const).includes(d.bore.type) ? d.bore.type : 'none',
      diameter: Math.max(0, num(d.bore.diameter, DEFAULT_DESIGN.bore.diameter)),
      recessDiameter: Math.max(0, num(d.bore.recessDiameter, DEFAULT_DESIGN.bore.recessDiameter)),
      hexAcrossFlats: Math.max(0, num(d.bore.hexAcrossFlats, DEFAULT_DESIGN.bore.hexAcrossFlats)),
    },
  }
}

// ---------------------------------------------------------------------------
// URL sharing: compact query string in the location hash
// ---------------------------------------------------------------------------

const round = (v: number) => String(Math.round(v * 1000) / 1000)

export function designToQuery(d: KnobDesign): string {
  const q = new URLSearchParams()
  q.set('name', d.name)
  q.set('m', d.mode === 'lobed' ? 'l' : 'd')
  q.set('n', String(d.lobes))
  if (d.rotation) q.set('rot', round(d.rotation))
  if (d.mode === 'drilled') {
    q.set('b', round(d.blankDiameter))
    q.set('h', round(d.holeDiameter))
    q.set('p', round(d.pitchDiameter))
    q.set('t', round(d.tipRadius))
  } else {
    q.set('ld', round(d.lobeDiameter))
    q.set('lp', round(d.lobePitchDiameter))
    q.set('vd', round(d.valleyDiameter))
  }
  q.set('bt', d.bore.type)
  if (d.bore.type !== 'none') q.set('bd', round(d.bore.diameter))
  if (d.bore.type === 'counterbore') q.set('br', round(d.bore.recessDiameter))
  if (d.bore.type === 'hex') q.set('bh', round(d.bore.hexAcrossFlats))
  return q.toString()
}

export function designFromQuery(query: string): KnobDesign | null {
  const q = new URLSearchParams(query)
  if (!q.has('n')) return null
  const num = (key: string) => {
    const v = q.get(key)
    return v === null ? undefined : parseFloat(v)
  }
  return normaliseDesign({
    name: q.get('name') ?? undefined,
    mode: q.get('m') === 'l' ? 'lobed' : 'drilled',
    lobes: num('n'),
    rotation: num('rot') ?? 0,
    blankDiameter: num('b'),
    holeDiameter: num('h'),
    pitchDiameter: num('p'),
    tipRadius: num('t'),
    lobeDiameter: num('ld'),
    lobePitchDiameter: num('lp'),
    valleyDiameter: num('vd'),
    bore: {
      type: (q.get('bt') as BoreType) ?? 'none',
      diameter: num('bd'),
      recessDiameter: num('br'),
      hexAcrossFlats: num('bh'),
    },
  })
}
