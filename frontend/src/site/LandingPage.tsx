import SiteShell from './SiteShell'
import Hero from './sections/Hero'
import Problem from './sections/Problem'
import Pipeline from './sections/Pipeline'
import Capabilities from './sections/Capabilities'
import CTA from './sections/CTA'

/* Metrics, Responsible and Stack used to render here too — but Metrics and
   Responsible are the whole of ImpactPage, and Stack is the whole of StackPage.
   A visitor scrolled the entire Impact and Stack pages inline, then clicked
   "Impact" or "Stack" in the nav and met them again.

   They are gone from here and untouched on their own pages, which the nav and
   the CTA both link to. The landing page now makes the case and hands off. */
export default function LandingPage() {
  return (
    <SiteShell>
      <Hero />
      <Problem />
      <Pipeline />
      <Capabilities />
      <CTA />
    </SiteShell>
  )
}
