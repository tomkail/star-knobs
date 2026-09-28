import { useMemo } from 'react'
import { Button, Callout, Field, NumberField, PrintDialog as KitPrintDialog, Switch } from '@tomkail/workshop-kit'
import { useDesignStore } from '../stores/designStore'
import { useSettingsStore, useUiStore } from '../stores/settingsStore'
import { computeKnob } from '../model/geometry'
import { buildPage } from '../model/template'
import styles from './PrintDialog.module.css'

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'star-knob'

export function PrintDialog() {
  const design = useDesignStore((s) => s.design)
  const unit = useSettingsStore((s) => s.unit)
  const print = useSettingsStore((s) => s.print)
  const setPrint = useSettingsStore((s) => s.setPrint)

  const geometry = useMemo(() => computeKnob(design), [design])
  const page = useMemo(() => buildPage(design, geometry, { ...print, unit }), [design, geometry, print, unit])
  const { layout } = page
  const copies = Math.min(print.copies, Math.max(1, layout.maxCopies))

  return (
    <KitPrintDialog
      title="Print template"
      pages={[page]}
      options={print}
      onChange={setPrint}
      onClose={() => useUiStore.getState().setDialog(null)}
      filename={slug(design.name)}
      documentTitle={design.name}
      physical
      labelsLabel="Spec & drilling order"
      notices={!geometry.valid && <Callout tone="danger">The design has errors, so the outline won’t be printed. Fix them in the panel first.</Callout>}
    >
      <Field label="Copies" htmlFor="copies" hint={layout.fits ? `Up to ${layout.maxCopies} fit on this page` : undefined}>
        <div className={styles.copiesRow}>
          <NumberField id="copies" value={copies} onChange={(v) => setPrint({ copies: Math.round(v) })} min={1} max={Math.max(1, layout.maxCopies)} step={1} format={(v) => String(Math.round(v))} />
          <Button onClick={() => setPrint({ copies: layout.maxCopies })} disabled={!layout.fits}>
            Fill page
          </Button>
        </div>
      </Field>
      <Switch checked={print.construction} onChange={(construction) => setPrint({ construction })} label="Construction lines" />
    </KitPrintDialog>
  )
}
