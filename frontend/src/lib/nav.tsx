import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

/* The console's seven sections. These are product areas, not pipeline
   layers — the engine still runs SENSE -> PREDICT -> ACT -> TRUST internally,
   but an officer navigates by what they are trying to do, not by which
   analytical stage produced the number.

     COMMAND      what is happening across the state right now
     INVESTIGATE  who and what is linked to this person, FIR or place
     CONNECT      criminal networks and how they fragment
     FORECAST     hotspots, trends, anomalies, week-ahead risk
     ACT          where to put the units, and what the next one buys
     REPLAY       what we predicted, against what actually happened
     TRUST        how well it works, where it fails, what it must not do */
export type Tab =
  | 'COMMAND'
  | 'INVESTIGATE'
  | 'CONNECT'
  | 'FORECAST'
  | 'ACT'
  | 'REPLAY'
  | 'TRUST'

interface NavPayload {
  tab: Tab
  district?: string
}

interface NavCtx {
  activeTab: Tab
  setActiveTab: (t: Tab) => void
  pending: NavPayload | null
  navigateTo: (p: NavPayload) => void
  consumePending: () => NavPayload | null
}

const Ctx = createContext<NavCtx>({
  activeTab: 'COMMAND',
  setActiveTab: () => {},
  pending: null,
  navigateTo: () => {},
  consumePending: () => null,
})

export function NavProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>('COMMAND')
  const [pending, setPending] = useState<NavPayload | null>(null)

  const navigateTo = useCallback((p: NavPayload) => {
    setPending(p)
    setActiveTab(p.tab)
  }, [])

  const consumePending = useCallback(() => {
    const p = pending
    setPending(null)
    return p
  }, [pending])

  return (
    <Ctx.Provider value={{ activeTab, setActiveTab, pending, navigateTo, consumePending }}>
      {children}
    </Ctx.Provider>
  )
}

export function useNav() {
  return useContext(Ctx)
}
