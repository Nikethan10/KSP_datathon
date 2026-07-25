import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Tab } from './nav'

/* Hash routing, deliberately dependency-free.
   Catalyst serves the client as static files with no SPA rewrite rule, and
   vite is pinned to base '/app/'. Hash routes work under both with zero
   server config, which a history router would not. */

export type Screen = 'landing' | 'how-it-works' | 'impact' | 'stack' | 'console'

const SITE_SCREENS: Screen[] = ['landing', 'how-it-works', 'impact', 'stack']

const TAB_BY_SLUG: Record<string, Tab> = {
  sense: 'SENSE',
  predict: 'PREDICT',
  act: 'ACT',
  trust: 'TRUST',
}

export const SLUG_BY_TAB: Record<Tab, string> = {
  SENSE: 'sense',
  PREDICT: 'predict',
  ACT: 'act',
  TRUST: 'trust',
}

export interface Route {
  screen: Screen
  /** console sub-route, e.g. #/console/predict */
  tab: Tab | null
  /** in-page anchor, e.g. #/#capabilities */
  anchor: string | null
}

function parse(hash: string): Route {
  // "#/console/predict" -> ["console", "predict"]
  const raw = hash.replace(/^#\/?/, '')
  const [path, anchor = null] = raw.split('#')
  const parts = path.split('/').filter(Boolean)
  const head = (parts[0] || '').toLowerCase()

  if (head === 'console') {
    return { screen: 'console', tab: TAB_BY_SLUG[parts[1]?.toLowerCase() ?? ''] ?? null, anchor }
  }
  const screen = SITE_SCREENS.find((s) => s === head)
  return { screen: screen ?? 'landing', tab: null, anchor }
}

interface RouteCtx extends Route {
  navigate: (to: string) => void
  isSite: boolean
}

const Ctx = createContext<RouteCtx>({
  screen: 'landing',
  tab: null,
  anchor: null,
  navigate: () => {},
  isSite: true,
})

export function RouteProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((to: string) => {
    const next = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`
    if (window.location.hash === next) {
      // same target — re-fire manually so in-page anchors still scroll
      setRoute(parse(next))
      return
    }
    window.location.hash = next
  }, [])

  // The console is a fixed-viewport app; the site scrolls. index.css keys
  // overflow and the border-radius clamp off this attribute.
  useEffect(() => {
    const root = document.getElementById('root')
    if (root) root.dataset.mode = route.screen === 'console' ? 'console' : 'site'
  }, [route.screen])

  // Scroll to top on screen change, or to the anchor when one is present.
  useEffect(() => {
    if (route.screen === 'console') return
    if (route.anchor) {
      const el = document.getElementById(route.anchor)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [route.screen, route.anchor])

  const value = useMemo<RouteCtx>(
    () => ({ ...route, navigate, isSite: route.screen !== 'console' }),
    [route, navigate],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRoute() {
  return useContext(Ctx)
}
