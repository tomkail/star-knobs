import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createHistory } from '@tomkail/workshop-kit'
import { DEFAULT_DESIGN, normaliseDesign, type KnobDesign } from '../model/design'
import { convertMode } from '../model/geometry'

interface DesignState {
  design: KnobDesign
  /** Merge changes into the design */
  update: (changes: Partial<KnobDesign>) => void
  updateBore: (changes: Partial<KnobDesign['bore']>) => void
  setMode: (mode: KnobDesign['mode']) => void
  load: (design: Partial<KnobDesign>) => void
}

export const useDesignStore = create<DesignState>()(
  persist(
    (set, get) => ({
      design: DEFAULT_DESIGN,
      update: (changes) => set({ design: normaliseDesign({ ...get().design, ...changes }) }),
      updateBore: (changes) => set({ design: normaliseDesign({ ...get().design, bore: { ...get().design.bore, ...changes } }) }),
      setMode: (mode) => set({ design: convertMode(get().design, mode) }),
      load: (design) => set({ design: normaliseDesign(design) }),
    }),
    {
      name: 'star-knobs-design',
      partialize: (state) => ({ design: state.design }),
      merge: (persisted, current) => ({ ...current, design: normaliseDesign((persisted as { design?: KnobDesign })?.design) }),
    }
  )
)

export const designHistory = createHistory(
  useDesignStore,
  (state) => state.design,
  (design) => useDesignStore.setState({ design })
)
