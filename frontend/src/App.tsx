import { Suspense, lazy, useEffect, useState } from 'react'
import { useRoute } from './lib/route'
import ConsoleSplash from './components/ConsoleSplash'
import LandingPage from './site/LandingPage'
import HowItWorksPage from './site/HowItWorksPage'
import ImpactPage from './site/ImpactPage'
import StackPage from './site/StackPage'

/* The console pulls in deck.gl, maplibre and three — roughly 2 MB that a
   visitor landing on the marketing page has no use for. Splitting it here
   lets the landing paint immediately and loads the console on demand. */
const ConsoleShell = lazy(() => import('./console/ConsoleShell'))

/* How long the splash stays up at minimum. The chunk resolves in ~100 ms
   from a warm cache, and a splash that appears and vanishes that fast reads
   as a rendering glitch rather than as branding. This is a floor, never a
   delay: if the download takes longer, the splash simply stays until it is
   done. Lower this if the console starts to feel gated behind it. */
const SPLASH_FLOOR_MS = 1300

/** Mounts only once its lazy sibling has resolved — our "chunk is ready" signal. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady])
  return null
}

function ConsoleRoute() {
  const [chunkReady, setChunkReady] = useState(false)
  const [floorPassed, setFloorPassed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setFloorPassed(true), SPLASH_FLOOR_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative h-full">
      {/* The console mounts and starts fetching its data underneath the
          splash, so the floor costs nothing — by the time the splash lifts,
          the maps have a head start. */}
      <Suspense fallback={null}>
        <ConsoleShell />
        <ReadySignal onReady={() => setChunkReady(true)} />
      </Suspense>

      {!(chunkReady && floorPassed) && <ConsoleSplash />}
    </div>
  )
}

export default function App() {
  const { screen } = useRoute()

  if (screen === 'console') return <ConsoleRoute />
  if (screen === 'how-it-works') return <HowItWorksPage />
  if (screen === 'impact') return <ImpactPage />
  if (screen === 'stack') return <StackPage />
  return <LandingPage />
}
