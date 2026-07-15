import { Suspense, lazy } from 'react'
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

export default function App() {
  const { screen } = useRoute()

  if (screen === 'console') {
    return (
      <div className="relative h-full">
        <Suspense fallback={<ConsoleSplash />}>
          <ConsoleShell />
        </Suspense>
      </div>
    )
  }

  if (screen === 'how-it-works') return <HowItWorksPage />
  if (screen === 'impact') return <ImpactPage />
  if (screen === 'stack') return <StackPage />
  return <LandingPage />
}
