// Cross-tab map focus. The header search sets a target; each tab's map mirrors
// it into its own flyTarget. The nonce makes repeated searches of the same place
// re-fire the fly.
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface FocusTarget {
  lat: number
  lon: number
  zoom?: number
  district?: string
}

interface FocusCtx {
  focus: (FocusTarget & { nonce: number }) | null
  setFocus: (t: FocusTarget) => void
}

const Ctx = createContext<FocusCtx>({ focus: null, setFocus: () => {} })

export function FocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocusState] = useState<(FocusTarget & { nonce: number }) | null>(null)
  const setFocus = useCallback((t: FocusTarget) => {
    setFocusState({ ...t, nonce: Date.now() })
  }, [])
  return <Ctx.Provider value={{ focus, setFocus }}>{children}</Ctx.Provider>
}

export function useFocus() {
  return useContext(Ctx)
}
