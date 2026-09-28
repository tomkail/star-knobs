import { useMemo, type ReactNode } from 'react'
import {
  Callout,
  Field,
  NumberField,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSection,
  Segmented,
  Select,
  Stat,
  bitsFor,
  formatLength,
  isStandardBit,
  nearestBit,
  parseLength,
  type LengthUnit,
} from '@tomkail/workshop-kit'
import { useDesignStore } from '../stores/designStore'
import { useSettingsStore } from '../stores/settingsStore'
import { computeKnob } from '../model/geometry'
import { HARDWARE_PRESETS, MAX_LOBES, MIN_LOBES, type BoreType, type KnobDesign } from '../model/design'
import { PRESETS } from '../model/presets'
import { len, specLines } from '../model/template'
import { loadDesign } from '../actions'
import styles from './DesignPanel.module.css'

interface LengthFieldProps {
  id: string
  label: ReactNode
  value: number
  onChange: (mm: number) => void
  unit: LengthUnit
  min?: number
  max?: number
  sliderMax?: number
  hint?: ReactNode
  /** Offer standard drill bits */
  bits?: boolean
  invalid?: boolean
}

function LengthField({ id, label, value, onChange, unit, min = 0, max = 500, sliderMax, hint, bits, invalid }: LengthFieldProps) {
  const format = (mm: number) => formatLength(mm, unit, { withUnit: false, mmDecimals: 2, inDecimals: 3 })
  const parse = (text: string) => parseLength(text, unit)
  const standard = bits ? isStandardBit(value) : null
  const nearest = bits ? nearestBit(value, unit) : null
  const bitOptions = bits ? bitsFor(unit).map((b) => ({ value: String(b.diameter), label: b.label })) : []

  return (
    <Field
      label={label}
      htmlFor={id}
      hint={
        <>
          {hint}
          {bits && (
            <span className={standard ? styles.ok : styles.muted}>
              {standard ? `✓ standard ${standard.label} bit` : `Not a standard size – nearest ${nearest!.label}`}
            </span>
          )}
        </>
      }
    >
      <div className={styles.lengthRow}>
        <NumberField
          id={id}
          value={value}
          onChange={onChange}
          format={format}
          parse={parse}
          min={min}
          max={max}
          step={unit === 'mm' ? 0.5 : 25.4 / 32}
          slider={sliderMax !== undefined}
          sliderMin={min}
          sliderMax={sliderMax}
          suffix={unit === 'mm' ? 'mm' : 'in'}
          invalid={invalid}
        />
        {bits && (
          <div className={styles.bitSelect}>
            <Select
              value={standard && standard.system === unit ? String(standard.diameter) : ''}
              options={[{ value: '', label: 'Bits…' }, ...bitOptions]}
              onChange={(v) => v && onChange(parseFloat(v))}
            />
          </div>
        )}
      </div>
    </Field>
  )
}

export function DesignPanel({ className }: { className?: string }) {
  const design = useDesignStore((s) => s.design)
  const update = useDesignStore((s) => s.update)
  const updateBore = useDesignStore((s) => s.updateBore)
  const setMode = useDesignStore((s) => s.setMode)
  const unit = useSettingsStore((s) => s.unit)
  const setSettings = useSettingsStore((s) => s.set)
  const g = useMemo(() => computeKnob(design), [design])

  const errorCodes = new Set(g.issues.filter((i) => i.level === 'error').map((i) => i.code))
  const scale = Math.max(g.blankRadius * 2, 40)
  const set = (changes: Partial<KnobDesign>) => update(changes)

  return (
    <Panel className={className}>
      <PanelHeader title="Star knob">
        <Segmented<LengthUnit>
          value={unit}
          onChange={(u) => setSettings({ unit: u })}
          options={[
            { value: 'mm', label: 'mm' },
            { value: 'in', label: 'in' },
          ]}
        />
      </PanelHeader>
      <PanelBody>
        <PanelSection>
          <input
            className={styles.name}
            value={design.name}
            onChange={(e) => set({ name: e.target.value })}
            aria-label="Design name"
            placeholder="Name this knob"
          />
          <Select
            value=""
            options={[{ value: '', label: 'Start from a preset…' }, ...PRESETS.map((p) => ({ value: p.id, label: p.design.name }))]}
            onChange={(id) => {
              const preset = PRESETS.find((p) => p.id === id)
              if (preset) loadDesign(preset.design)
            }}
          />
        </PanelSection>

        <PanelSection title="Method">
          <Segmented
            value={design.mode}
            onChange={setMode}
            options={[
              { value: 'drilled', label: 'Drill a blank', title: 'Drill holes around a round blank' },
              { value: 'lobed', label: 'Shape lobes', title: 'Lay out lobes, then drill the valleys between them' },
            ]}
          />
          <p className={styles.explain}>
            {design.mode === 'drilled'
              ? 'Holes drilled on a circle around a round blank cut the scallops; the wood left between them becomes the lobes.'
              : 'Round lobes on a circle, joined by concave valleys. The valleys are still drilled holes; the lobes are sawn and sanded to the line.'}
          </p>
        </PanelSection>

        <PanelSection title="Layout">
          <Field label="Lobes" htmlFor="lobes">
            <NumberField id="lobes" value={design.lobes} onChange={(n) => set({ lobes: n })} min={MIN_LOBES} max={MAX_LOBES} step={1} slider sliderMax={12} format={(v) => String(Math.round(v))} />
          </Field>
          <Field label="Rotation" htmlFor="rotation" hint={`${Math.round(360 / design.lobes * 100) / 100}° between lobes`}>
            <NumberField id="rotation" value={design.rotation} onChange={(v) => set({ rotation: v })} min={-180} max={180} step={1} slider suffix="°" format={(v) => String(Math.round(v * 10) / 10)} />
          </Field>
        </PanelSection>

        {design.mode === 'drilled' ? (
          <PanelSection title="Blank & holes">
            <LengthField id="blank" label="Blank Ø" value={design.blankDiameter} onChange={(v) => set({ blankDiameter: v })} unit={unit} min={5} sliderMax={Math.max(150, design.blankDiameter)} invalid={errorCodes.has('no-cut') || errorCodes.has('enclosed')} />
            <LengthField id="hole" label="Hole (bit) Ø" value={design.holeDiameter} onChange={(v) => set({ holeDiameter: v })} unit={unit} min={1} sliderMax={Math.max(65, design.holeDiameter)} bits invalid={errorCodes.has('overlap')} />
            <LengthField
              id="pitch"
              label="Hole pitch Ø"
              value={design.pitchDiameter}
              onChange={(v) => set({ pitchDiameter: v })}
              unit={unit}
              min={1}
              sliderMax={Math.max(scale * 1.8, design.pitchDiameter)}
              hint={`Holes cut ${len(Math.max(0, g.stats.scallopDepth), unit)} into the rim`}
              invalid={errorCodes.has('no-cut') || errorCodes.has('enclosed') || errorCodes.has('center')}
            />
            <LengthField
              id="tip"
              label="Tip radius"
              value={design.tipRadius}
              onChange={(v) => set({ tipRadius: v })}
              unit={unit}
              min={0}
              sliderMax={Math.max(0.5, Math.floor(g.maxTipRadius * 10) / 10)}
              hint={g.valid ? <>Max {len(g.maxTipRadius, unit)} (fully round) · <button className={styles.link} onClick={() => set({ tipRadius: 0 })}>sharp</button> · <button className={styles.link} onClick={() => set({ tipRadius: g.maxTipRadius })}>max</button></> : undefined}
            />
          </PanelSection>
        ) : (
          <PanelSection title="Lobes & valleys">
            <LengthField id="lobeD" label="Lobe Ø" value={design.lobeDiameter} onChange={(v) => set({ lobeDiameter: v })} unit={unit} min={1} sliderMax={Math.max(60, design.lobeDiameter)} />
            <LengthField id="lobeP" label="Lobe pitch Ø" value={design.lobePitchDiameter} onChange={(v) => set({ lobePitchDiameter: v })} unit={unit} min={1} sliderMax={Math.max(150, design.lobePitchDiameter)} hint="Circle through the lobe centres" />
            <LengthField id="valley" label="Valley (bit) Ø" value={design.valleyDiameter} onChange={(v) => set({ valleyDiameter: v })} unit={unit} min={1} sliderMax={Math.max(65, design.valleyDiameter)} bits invalid={errorCodes.has('valley-gap') || errorCodes.has('overlap')} />
          </PanelSection>
        )}

        <PanelSection title="Centre bore">
          <Segmented<BoreType>
            value={design.bore.type}
            onChange={(type) => updateBore({ type })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'round', label: 'Hole' },
              { value: 'counterbore', label: 'C-bore', title: 'Counterbore (e.g. T-nut flange)' },
              { value: 'hex', label: 'Hex', title: 'Hex recess for a bolt head or nut' },
            ]}
          />
          {design.bore.type !== 'none' && (
            <LengthField id="boreD" label="Through Ø" value={design.bore.diameter} onChange={(v) => updateBore({ diameter: v })} unit={unit} min={0} bits invalid={errorCodes.has('bore')} />
          )}
          {design.bore.type === 'counterbore' && (
            <LengthField id="boreR" label="Counterbore Ø" value={design.bore.recessDiameter} onChange={(v) => updateBore({ recessDiameter: v })} unit={unit} min={0} bits invalid={errorCodes.has('bore')} />
          )}
          {design.bore.type === 'hex' && (
            <LengthField
              id="boreH"
              label="Hex across flats"
              value={design.bore.hexAcrossFlats}
              onChange={(v) => updateBore({ hexAcrossFlats: v })}
              unit={unit}
              min={0}
              hint={`${len((design.bore.hexAcrossFlats * 2) / Math.sqrt(3), unit)} across corners`}
              invalid={errorCodes.has('bore')}
            />
          )}
          <Select
            value=""
            options={[{ value: '', label: 'Hardware sizes…' }, ...HARDWARE_PRESETS.map((h) => ({ value: h.id, label: h.label }))]}
            onChange={(id) => {
              const preset = HARDWARE_PRESETS.find((h) => h.id === id)
              if (preset) updateBore(preset.bore)
            }}
          />
        </PanelSection>

        <PanelSection title={g.issues.length ? 'Checks' : 'Checks ✓'}>
          {g.issues.length === 0 && <p className={styles.explain}>No problems found.</p>}
          {g.issues.map((issue) => (
            <Callout key={issue.code} tone={issue.level === 'error' ? 'danger' : issue.level === 'warning' ? 'warning' : 'info'}>
              {issue.message}
            </Callout>
          ))}
        </PanelSection>

        <PanelSection title="Measurements">
          <Stat label="Overall Ø" value={len(g.stats.overallDiameter, unit)} />
          <Stat label="Scallop depth" value={len(g.stats.scallopDepth, unit)} />
          <Stat label="Core Ø (at scallops)" value={len(g.stats.coreDiameter, unit)} />
          {design.bore.type !== 'none' && <Stat label="Wall to bore" value={len(g.stats.boreWall, unit)} tone={g.stats.boreWall < 4 ? 'warning' : undefined} />}
          <Stat label="Neck width" value={g.stats.neckWidth === null ? '—' : len(g.stats.neckWidth, unit)} tone={g.stats.neckWidth !== null && g.stats.neckWidth < 5 ? 'warning' : undefined} />
          {design.mode === 'drilled' && <Stat label="Flat on each tip" value={len(g.stats.tipFlatWidth, unit)} />}
          <Stat label="Hole spacing" value={`${Math.round(g.stats.holeSpacingDeg * 100) / 100}°`} />
          <Stat label="Step-off chord" value={len(g.stats.holeChord, unit)} />
          <p className={styles.explain}>Set dividers to the step-off chord to walk the hole centres round the pitch circle by hand.</p>
        </PanelSection>

        <PanelSection title="Template notes">
          <ul className={styles.spec}>
            {specLines(design, g, unit).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </PanelSection>
      </PanelBody>
    </Panel>
  )
}
