import SiteShell from './SiteShell'
import Hero from './sections/Hero'
import Problem from './sections/Problem'
import Pipeline from './sections/Pipeline'
import Capabilities from './sections/Capabilities'
import Metrics from './sections/Metrics'
import Responsible from './sections/Responsible'
import Stack from './sections/Stack'
import CTA from './sections/CTA'

export default function LandingPage() {
  return (
    <SiteShell>
      <Hero />
      <Problem />
      <Pipeline />
      <Capabilities />
      <Metrics />
      <Responsible />
      <Stack />
      <CTA />
    </SiteShell>
  )
}
