import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createThemeStore, createViewportStore, defaultPaperId, defaultUnit, screenInfo, type LengthUnit, type ScreenCalibration } from '@tomkail/workshop-kit'

export interface PrintSettings {
  paperId: string
  landscape: boolean
  copies: number
  labels: boolean
  construction: boolean
  scaleCheck: boolean
}

interface SettingsState {
  unit: LengthUnit
  showConstruction: boolean
  showMeasurements: boolean
  /** Snap dragged lengths to 0.5 mm / 1/32″ and angles to 15° */
  snap: boolean
  /** Snap drill diameters to standard bit sizes */
  snapToBits: boolean
  /** Screen scale for the 1:1 view, per screen signature (see workshop-kit screenScale) */
  screenCalibrations: Record<string, ScreenCalibration>
  print: PrintSettings
  panelOpen: boolean

  set: (changes: Partial<Omit<SettingsState, 'set' | 'setPrint'>>) => void
  setPrint: (changes: Partial<PrintSettings>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      unit: defaultUnit(),
      showConstruction: true,
      showMeasurements: true,
      snap: true,
      snapToBits: true,
      screenCalibrations: {},
      print: { paperId: defaultPaperId(), landscape: false, copies: 1, labels: true, construction: true, scaleCheck: true },
      panelOpen: false,
      set: (changes) => set(changes),
      setPrint: (changes) => set({ print: { ...get().print, ...changes } }),
    }),
    {
      name: 'star-knobs-settings',
      partialize: ({ set: _set, setPrint: _setPrint, panelOpen: _panelOpen, ...rest }) => rest,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState> & { pxPerMm?: number; screenCalibrated?: boolean }
        const { pxPerMm, screenCalibrated, ...rest } = saved
        const merged = { ...current, ...rest, print: { ...current.print, ...saved.print }, screenCalibrations: { ...saved.screenCalibrations } }
        // Older versions stored one calibration for every screen; keep it for the current one
        if (screenCalibrated && pxPerMm) {
          merged.screenCalibrations[screenInfo().signature] ??= { pxPerMm, source: 'measured', label: 'Measured' }
        }
        return merged
      },
    }
  )
)

/** Theme key shared across workshop tools so they follow the same theme */
export const useThemeStore = createThemeStore('workshop-theme')

/** World units are millimetres; zoom is screen px per mm. Not persisted: we fit the knob on load. */
export const useViewportStore = createViewportStore({
  defaultZoom: 5,
  minZoom: 0.5,
  maxZoom: 80,
  fitPaddingRatio: 0.12,
})

export type Dialog = 'print' | 'calibrate' | 'about' | null

export const useUiStore = create<{ dialog: Dialog; setDialog: (dialog: Dialog) => void }>()((set) => ({
  dialog: null,
  setDialog: (dialog) => set({ dialog }),
}))
