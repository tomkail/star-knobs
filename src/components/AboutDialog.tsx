import { useMemo } from 'react'
import { Modal, drawingToSvg, modKey } from '@tomkail/workshop-kit'
import { useUiStore } from '../stores/settingsStore'
import { computeKnob } from '../model/geometry'
import { PRESETS } from '../model/presets'
import { buildKnobDrawing } from '../model/template'
import styles from './AboutDialog.module.css'

const SHORTCUTS: [string, string][] = [
  [`${modKey}Z / ${modKey}⇧Z`, 'Undo / redo'],
  [`${modKey}P`, 'Print template'],
  [`${modKey}S / ${modKey}O`, 'Save / open design file'],
  [`${modKey}E`, 'Download SVG'],
  ['[ / ]', 'Fewer / more lobes'],
  ['F', 'Fit to view'],
  ['1', 'Actual size (1:1)'],
  ['M', 'Dimensions'],
  ['C', 'Construction lines'],
  ['S', 'Snapping (hold Shift while dragging for free)'],
  ['U', 'Toggle mm / inches'],
  ['Space + drag, scroll', 'Pan, zoom'],
]

function Example({ presetId }: { presetId: string }) {
  const svg = useMemo(() => {
    const design = PRESETS.find((p) => p.id === presetId)!.design
    const { drawing } = buildKnobDrawing(design, computeKnob(design), { unit: 'mm', labels: false, construction: true })
    return drawingToSvg(drawing).replace(/^<\?xml[^>]*>\s*/, '').replace(/width="[^"]*mm" height="[^"]*mm"/, 'width="100%" height="100%"')
  }, [presetId])
  return <div className={styles.example} dangerouslySetInnerHTML={{ __html: svg }} />
}

export function AboutDialog() {
  const close = () => useUiStore.getState().setDialog(null)
  return (
    <Modal title="How Star Knobs works" onClose={close} wide>
      <div className={styles.columns}>
        <section>
          <Example presetId="five-lobe" />
          <h3>Drill a blank</h3>
          <p>
            The classic shop method. Mark a round blank, then drill holes whose centres sit on a slightly larger pitch circle. Each hole scallops the rim and the wood left between holes becomes a lobe. A tip radius
            rounds the sharp corners you’d otherwise sand off by eye.
          </p>
        </section>
        <section>
          <Example presetId="eight-flute" />
          <h3>Shape lobes</h3>
          <p>
            The same shape seen the other way round: N round lobes on a circle, joined by concave valleys. The valleys are still drilled holes, so the template gives the bit size and centres. You then saw and sand
            round the lobes. Push the tip radius in “Drill a blank” to its max and you get this shape.
          </p>
        </section>
      </div>
      <h3>Tips from the shop</h3>
      <ul className={styles.list}>
        <li>Drill the scallop holes <em>before</em> cutting the blank round. The bit is fully supported in square stock and the holes stay crisp.</li>
        <li>A Forstner bit leaves the cleanest scallop. Back the stock with scrap to stop tear-out as the bit exits.</li>
        <li>Stick the printed template on with spray adhesive or double-sided tape, and centre-punch each crosshair.</li>
        <li>No printer? Set dividers to the step-off chord and walk the hole centres round the pitch circle.</li>
        <li>Keep the lobe necks wide on short-grain woods, or glue up cross-grain plywood.</li>
      </ul>
      <h3>Printing at the right size</h3>
      <p>
        Templates are laid out in real millimetres. Print at <strong>100% / Actual size</strong> and measure the scale-check rulers before drilling. PDF, SVG and DXF downloads carry the same dimensions for CAD, laser
        and CNC.
      </p>
      <h3>Keyboard</h3>
      <dl className={styles.shortcuts}>
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys}>
            <dt>{keys}</dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.footer}>
        Part of a family of woodworking tools. See also{' '}
        <a href="https://tomkail.github.io/serpentine/" target="_blank" rel="noreferrer">
          Serpentine
        </a>{' '}
        for smooth curves built from circles.
      </p>
    </Modal>
  )
}
