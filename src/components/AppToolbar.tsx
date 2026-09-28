import { useState } from 'react'
import {
  ChevronDown,
  CircleDashed,
  File as FileIcon,
  Magnet,
  Printer,
  Redo2,
  Ruler,
  Scan,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react'
import {
  DropdownMenu,
  IconButton,
  IconToggle,
  MenuDivider,
  MenuItem,
  MenuLabel,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
  modKey,
  themeList,
} from '@tomkail/workshop-kit'
import { designHistory } from '../stores/designStore'
import { useSettingsStore, useThemeStore, useUiStore } from '../stores/settingsStore'
import { PRESETS } from '../model/presets'
import {
  actualSize,
  copyShareLink,
  exportDxf,
  exportKnobSvg,
  exportPagePdf,
  fitView,
  loadDesign,
  newDesign,
  openDesign,
  saveDesign,
} from '../actions'
import styles from './AppToolbar.module.css'

export function AppToolbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const { canUndo, canRedo } = designHistory.useHistory()
  const settings = useSettingsStore()
  const themeName = useThemeStore((s) => s.themeName)
  const setTheme = useThemeStore((s) => s.setTheme)
  const setDialog = useUiStore((s) => s.setDialog)

  const close = () => setOpenMenu(null)
  const toggle = (menu: string) => setOpenMenu(openMenu === menu ? null : menu)
  const run = (fn: () => void) => () => {
    fn()
    close()
  }

  return (
    <Toolbar>
      <ToolbarGroup>
        <DropdownMenu
          trigger={
            <>
              <FileIcon size={18} />
              <ChevronDown size={12} />
            </>
          }
          isOpen={openMenu === 'file'}
          onToggle={() => toggle('file')}
          onClose={close}
          tooltip="File"
        >
          <MenuItem label="New" onClick={run(newDesign)} />
          <MenuItem label="Open…" shortcut={`${modKey}O`} onClick={run(openDesign)} />
          <MenuItem label="Save…" shortcut={`${modKey}S`} onClick={run(saveDesign)} />
          <MenuItem label="Copy share link" onClick={run(copyShareLink)} />
          <MenuDivider />
          <MenuLabel>Template</MenuLabel>
          <MenuItem label="Print…" shortcut={`${modKey}P`} onClick={run(() => setDialog('print'))} />
          <MenuItem label="Download PDF page" onClick={run(exportPagePdf)} />
          <MenuItem label="Download SVG (1:1)" shortcut={`${modKey}E`} onClick={run(exportKnobSvg)} />
          <MenuItem label="Download DXF (CAD / CNC)" onClick={run(exportDxf)} />
          <MenuDivider />
          <MenuLabel>Presets</MenuLabel>
          {PRESETS.map((preset) => (
            <MenuItem key={preset.id} label={preset.design.name} onClick={run(() => loadDesign(preset.design))} />
          ))}
        </DropdownMenu>
        <IconButton label="Undo" shortcut={`${modKey}Z`} onClick={designHistory.undo} disabled={!canUndo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Redo" shortcut={`${modKey}⇧Z`} onClick={designHistory.redo} disabled={!canRedo}>
          <Redo2 size={18} />
        </IconButton>
      </ToolbarGroup>

      <span className={styles.desktopOnly}>
        <ToolbarSeparator />
        <ToolbarGroup>
          <IconButton label="Print template" shortcut={`${modKey}P`} onClick={() => setDialog('print')}>
            <Printer size={18} />
          </IconButton>
        </ToolbarGroup>
      </span>

      <ToolbarSeparator />

      <ToolbarGroup>
        <IconButton label="Fit to view" shortcut="F" onClick={fitView}>
          <Scan size={18} />
        </IconButton>
        <span className={styles.desktopOnly}>
          <IconButton label="Actual size" shortcut="1" onClick={actualSize}>
            <span className={styles.textIcon}>1:1</span>
          </IconButton>
          <IconToggle label="Dimensions" shortcut="M" active={settings.showMeasurements} onClick={() => settings.set({ showMeasurements: !settings.showMeasurements })}>
            <Ruler size={18} />
          </IconToggle>
          <IconToggle label="Construction lines" shortcut="C" active={settings.showConstruction} onClick={() => settings.set({ showConstruction: !settings.showConstruction })}>
            <CircleDashed size={18} />
          </IconToggle>
          <IconToggle label="Snap (hold Shift for free)" shortcut="S" active={settings.snap} onClick={() => settings.set({ snap: !settings.snap })}>
            <Magnet size={18} />
          </IconToggle>
        </span>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <span className={styles.mobileOnly}>
          <IconToggle label="Parameters" active={settings.panelOpen} onClick={() => settings.set({ panelOpen: !settings.panelOpen })}>
            <SlidersHorizontal size={18} />
          </IconToggle>
        </span>
        <DropdownMenu
          trigger={
            <>
              <SettingsIcon size={18} />
              <ChevronDown size={12} />
            </>
          }
          isOpen={openMenu === 'settings'}
          onToggle={() => toggle('settings')}
          onClose={close}
          tooltip="Settings"
          align="right"
        >
          <MenuLabel>View</MenuLabel>
          <MenuItem label="Dimensions" checked={settings.showMeasurements} shortcut="M" onClick={run(() => settings.set({ showMeasurements: !settings.showMeasurements }))} />
          <MenuItem label="Construction lines" checked={settings.showConstruction} shortcut="C" onClick={run(() => settings.set({ showConstruction: !settings.showConstruction }))} />
          <MenuItem label="Snap while dragging" checked={settings.snap} shortcut="S" onClick={run(() => settings.set({ snap: !settings.snap }))} />
          <MenuItem label="Actual size (1:1)" shortcut="1" onClick={run(actualSize)} />
          <MenuDivider />
          <MenuLabel>Units</MenuLabel>
          <MenuItem label="Millimetres" checked={settings.unit === 'mm'} shortcut="U" onClick={run(() => settings.set({ unit: 'mm' }))} />
          <MenuItem label="Inches" checked={settings.unit === 'in'} onClick={run(() => settings.set({ unit: 'in' }))} />
          <MenuDivider />
          <MenuItem label="Snap bits to standard sizes" checked={settings.snapToBits} onClick={run(() => settings.set({ snapToBits: !settings.snapToBits }))} />
          <MenuItem label="Calibrate screen for 1:1…" onClick={run(() => setDialog('calibrate'))} />
          <MenuDivider />
          <MenuLabel>Theme</MenuLabel>
          {themeList.map((theme) => (
            <MenuItem key={theme.id} label={`${theme.icon} ${theme.name}`} checked={themeName === theme.id} onClick={run(() => setTheme(theme.id))} />
          ))}
          <MenuDivider />
          <MenuItem label="How it works & shortcuts" shortcut="?" onClick={run(() => setDialog('about'))} />
          <MenuItem
            label="Reset all preferences…"
            onClick={() => {
              if (!window.confirm('Reset your design, settings and theme?')) return
              ;['star-knobs-design', 'star-knobs-settings', 'workshop-theme'].forEach((key) => localStorage.removeItem(key))
              window.location.hash = ''
              window.location.reload()
            }}
          />
        </DropdownMenu>
      </ToolbarGroup>
    </Toolbar>
  )
}
