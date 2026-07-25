import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

export type Tab = 'SENSE' | 'PREDICT' | 'ACT' | 'TRUST'

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
  activeTab: 'SENSE',
  setActiveTab: () => {},
  pending: null,
  navigateTo: () => {},
  consumePending: () => null,
})

export function NavProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>('SENSE')
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
