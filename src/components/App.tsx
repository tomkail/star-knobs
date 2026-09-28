import { useEffect } from 'react'
import { Notifications, ThemeProvider, useHotkeys } from '@tomkail/workshop-kit'
import { KnobCanvas } from './KnobCanvas'
import { DesignPanel } from './DesignPanel'
import { AppToolbar } from './AppToolbar'
import { PrintDialog } from './PrintDialog'
import { CalibrateDialog } from './CalibrateDialog'
import { AboutDialog } from './AboutDialog'
import { designHistory, useDesignStore } from '../stores/designStore'
import { useSettingsStore, useThemeStore, useUiStore } from '../stores/settingsStore'
import { designFromQuery, designToQuery, clampLobes } from '../model/design'
import { actualSize, exportKnobSvg, fitView, loadDesign, openDesign, saveDesign } from '../actions'
import styles from './App.module.css'

/** Load a design from the URL hash on startup, and keep the hash in sync so the URL is always shareable */
function useHashSync() {
  const design = useDesignStore((s) => s.design)

  useEffect(() => {
    const fromHash = designFromQuery(window.location.hash.slice(1))
    if (fromHash) {
      loadDesign(fromHash)
      designHistory.clear()
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      window.history.replaceState(null, '', `#${designToQuery(design)}`)
      document.title = `${design.name} – Star Knobs`
    }, 250)
    return () => clearTimeout(id)
  }, [design])
}

export default function App() {
  const theme = useThemeStore((s) => s.theme)
  const dialog = useUiStore((s) => s.dialog)
  const setDialog = useUiStore((s) => s.setDialog)
  const panelOpen = useSettingsStore((s) => s.panelOpen)
  useHashSync()

  const settings = () => useSettingsStore.getState()
  const bumpLobes = (delta: number) => {
    const { design, update } = useDesignStore.getState()
    update({ lobes: clampLobes(design.lobes + delta) })
  }

  useHotkeys({
    'mod+z': designHistory.undo,
    'mod+shift+z': designHistory.redo,
    'mod+y': designHistory.redo,
    'mod+p': () => setDialog('print'),
    'mod+s': saveDesign,
    'mod+o': openDesign,
    'mod+e': exportKnobSvg,
    f: fitView,
    '1': actualSize,
    m: () => settings().set({ showMeasurements: !settings().showMeasurements }),
    c: () => settings().set({ showConstruction: !settings().showConstruction }),
    s: () => settings().set({ snap: !settings().snap }),
    u: () => settings().set({ unit: settings().unit === 'mm' ? 'in' : 'mm' }),
    '[': () => bumpLobes(-1),
    ']': () => bumpLobes(1),
    '?': () => setDialog('about'),
    escape: () => settings().set({ panelOpen: false }),
  })

  return (
    <ThemeProvider theme={theme}>
      <div className={styles.app}>
        <main className={styles.main}>
          <KnobCanvas />
          <DesignPanel className={`${styles.panel} ${panelOpen ? styles.panelOpen : ''}`} />
        </main>
        <AppToolbar />
        <Notifications />
        {dialog === 'print' && <PrintDialog />}
        {dialog === 'calibrate' && <CalibrateDialog />}
        {dialog === 'about' && <AboutDialog />}
      </div>
    </ThemeProvider>
  )
}
