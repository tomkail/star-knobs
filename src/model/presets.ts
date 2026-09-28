import { DEFAULT_DESIGN, HARDWARE_PRESETS, type KnobDesign } from './design'

const hardware = (id: string) => HARDWARE_PRESETS.find((h) => h.id === id)!.bore
const IN = 25.4

export interface Preset {
  id: string
  design: KnobDesign
}

const preset = (id: string, design: Partial<KnobDesign>): Preset => ({ id, design: { ...DEFAULT_DESIGN, ...design } })

export const PRESETS: Preset[] = [
  preset('five-lobe', {}),
  preset('three-lobe', {
    name: 'Three-lobe knob',
    lobes: 3,
    blankDiameter: 50,
    holeDiameter: 25,
    pitchDiameter: 52,
    tipRadius: 3,
    bore: hardware('m8-hex'),
  }),
  preset('six-lobe', {
    name: 'Six-lobe knob',
    lobes: 6,
    blankDiameter: 70,
    holeDiameter: 18,
    pitchDiameter: 76,
    tipRadius: 2,
    bore: hardware('m8-hex'),
  }),
  preset('clamp-knob', {
    name: '3″ four-lobe clamp knob',
    lobes: 4,
    blankDiameter: 3 * IN,
    holeDiameter: 1 * IN,
    pitchDiameter: 3.125 * IN,
    tipRadius: 0.125 * IN,
    bore: hardware('3/8-hex'),
  }),
  preset('wing', {
    name: 'Two-lobe wing knob',
    lobes: 2,
    blankDiameter: 60,
    holeDiameter: 40,
    pitchDiameter: 64,
    tipRadius: 4,
    rotation: 90,
    bore: hardware('m6-hex'),
  }),
  preset('eight-flute', {
    name: 'Eight-flute lobed knob',
    mode: 'lobed',
    lobes: 8,
    lobeDiameter: 12,
    lobePitchDiameter: 50,
    valleyDiameter: 12,
    bore: hardware('m8-insert'),
  }),
  preset('flower', {
    name: 'Seven-lobe flower knob',
    mode: 'lobed',
    lobes: 7,
    lobeDiameter: 16,
    lobePitchDiameter: 44,
    valleyDiameter: 14,
    bore: hardware('1/4-insert'),
  }),
]
