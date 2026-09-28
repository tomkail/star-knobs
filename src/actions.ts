import { resolveScreenScale, downloadBlob, drawingToDxf, drawingToSvg, drawingsToPdf, notify, pickTextFile, printDrawings } from '@tomkail/workshop-kit'
import { DEFAULT_DESIGN, designToQuery, normaliseDesign, type KnobDesign } from './model/design'
import { computeKnob, templateRadius } from './model/geometry'
import { buildKnobDrawing, buildPage } from './model/template'
import { designHistory, useDesignStore } from './stores/designStore'
import { useSettingsStore, useUiStore, useViewportStore } from './stores/settingsStore'

/** Canvas size in CSS px, kept up to date by the canvas component */
export const canvasSize = { width: 0, height: 0 }

const current = () => {
  const design = useDesignStore.getState().design
  return { design, geometry: computeKnob(design), settings: useSettingsStore.getState() }
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'star-knob'

export function fitView() {
  const { geometry } = current()
  const r = templateRadius(geometry) + 4
  useViewportStore.getState().fitToRect({ x: -r, y: -r, width: r * 2, height: r * 2 }, canvasSize.width, canvasSize.height)
}

/** Zoom so 1 mm on screen is 1 mm in real life (using the calibrated px/mm) */
export function actualSize() {
  const { settings } = current()
  const scale = resolveScreenScale(settings.screenCalibrations)
  // Browsers can't report physical screen size; ask unless we recognise the display or it's been set
  if (!scale.confident) {
    useUiStore.getState().setDialog('calibrate')
    return
  }
  useViewportStore.getState().centerOn({ x: 0, y: 0 }, canvasSize.width, canvasSize.height, scale.pxPerMm)
  notify.info(`Actual size, using ${scale.label}. Not right? Settings → Calibrate screen.`)
}

export function newDesign() {
  useDesignStore.getState().load(DEFAULT_DESIGN)
  requestAnimationFrame(fitView)
}

export function loadDesign(design: KnobDesign) {
  useDesignStore.getState().load(design)
  designHistory.flush()
  requestAnimationFrame(fitView)
}

export function saveDesign() {
  const { design } = current()
  const file = { app: 'star-knobs', version: 1, design }
  downloadBlob(JSON.stringify(file, null, 2), `${slug(design.name)}.starknob.json`, 'application/json')
}

export async function openDesign() {
  const file = await pickTextFile('.json,.starknob,application/json')
  if (!file) return
  try {
    const parsed = JSON.parse(file.text)
    const design = parsed?.design ?? parsed
    if (typeof design !== 'object' || design === null || !('lobes' in design)) throw new Error('This doesn’t look like a Star Knobs file.')
    loadDesign(normaliseDesign(design))
    notify.success(`Opened ${file.name}`)
  } catch (error) {
    notify.error(`Couldn’t open ${file.name}`, error instanceof Error ? error.message : String(error))
  }
}

export function shareUrl(design: KnobDesign = useDesignStore.getState().design): string {
  const url = new URL(window.location.href)
  url.hash = designToQuery(design)
  return url.toString()
}

export async function copyShareLink() {
  const url = shareUrl()
  try {
    await navigator.clipboard.writeText(url)
    notify.success('Share link copied to clipboard')
  } catch {
    window.prompt('Copy this link:', url)
  }
}

function warnIfInvalid(): boolean {
  const { geometry } = current()
  if (!geometry.valid) {
    notify.warning('The design has errors, so the outline is missing from the export. Fix the issues listed in the panel first.')
  }
  return geometry.valid
}

/** Just the knob at 1:1 on a tight artboard */
export function exportKnobSvg() {
  const { design, geometry, settings } = current()
  warnIfInvalid()
  const { drawing } = buildKnobDrawing(design, geometry, { unit: settings.unit, labels: true, construction: settings.print.construction })
  downloadBlob(drawingToSvg(drawing, { title: design.name }), `${slug(design.name)}.svg`, 'image/svg+xml')
}

/** Outline, holes and bore for CAD / CNC / laser, no construction or text */
export function exportDxf() {
  const { design, geometry, settings } = current()
  warnIfInvalid()
  const { drawing } = buildKnobDrawing(design, geometry, { unit: settings.unit, labels: false, construction: false })
  downloadBlob(drawingToDxf(drawing, { text: false }), `${slug(design.name)}.dxf`, 'application/dxf')
}

export function buildCurrentPage() {
  const { design, geometry, settings } = current()
  return buildPage(design, geometry, { ...settings.print, unit: settings.unit })
}

export function exportPagePdf() {
  const { design } = current()
  warnIfInvalid()
  downloadBlob(drawingsToPdf([buildCurrentPage()], { title: design.name }), `${slug(design.name)}.pdf`, 'application/pdf')
}

export function exportPageSvg() {
  const { design } = current()
  warnIfInvalid()
  downloadBlob(drawingToSvg(buildCurrentPage(), { title: design.name, background: '#ffffff' }), `${slug(design.name)}-page.svg`, 'image/svg+xml')
}

export function printPage() {
  const { design } = current()
  warnIfInvalid()
  return printDrawings([buildCurrentPage()], design.name)
}
