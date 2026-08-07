import { LocalReportRepository } from './local'
import type { ReportRepository } from './repository'

export * from './types'
export * from './lifecycle'
export type { ReportRepository } from './repository'
export { LocalReportRepository } from './local'

/* Which backend the console talks to.

   `local` is the default on purpose. The Catalyst API is same-origin in
   production (`/server/...` beside `/app/`), so there is no CORS there — but
   `npm run dev` runs on localhost:5173, and pointing that at the deployed API
   would hit a CORS wall on the first request. Defaulting to local means
   development never meets that problem at all.

   Set VITE_REPORTS_MODE=catalyst to talk to the real backend. */
const MODE = import.meta.env.VITE_REPORTS_MODE ?? 'local'

export const API_BASE = `${location.origin}/server/prahari_api/v1`

function build(): ReportRepository {
  if (MODE === 'catalyst') {
    /* Phase 2. Deliberately not stubbed out with a fake that resolves — a silent
       no-op backend is worse than a loud missing one. */
    throw new Error(
      'VITE_REPORTS_MODE=catalyst is set, but the Catalyst adapter is not built yet.',
    )
  }
  return new LocalReportRepository()
}

export const reports: ReportRepository = build()

/** True when nothing is persisted server-side and the OTP is a fixed demo code.
    The UI must say so plainly wherever a reporter could mistake it for live. */
export const REPORTS_DEMO_MODE = MODE !== 'catalyst'
