import type { ReportStatus } from './types'

/* The one authority on how a report may move. The triage buttons are a mirror of
   this table, and so is the server's validator — the parity test in
   __tests__/lifecycle.test.ts asserts this stays equal to lifecycle.fixture.json,
   which is what the Catalyst function will read. Change one, change both. */

export type Role = 'citizen' | 'officer' | 'supervisor' | 'system'

/** Conditions the table cannot express as a role alone. */
export type Guard =
  /** Citizen may retract, but only inside 24 h of submitting. */
  | 'within24h'
  /** Blocked once the row has been sealed into an export batch — the pipeline may
      already have consumed it, and un-verifying it would desync the analytics. */
  | 'notSealed'
  /** System auto-rejects a report whose author never answered. */
  | 'after7d'

export interface Transition {
  to: ReportStatus
  roles: Role[]
  guard?: Guard
  reasonRequired?: boolean
  firRequired?: boolean
  dupRequired?: boolean
}

export const TRANSITIONS: Readonly<Record<ReportStatus, readonly Transition[]>> = {
  SUBMITTED: [
    { to: 'TRIAGE', roles: ['officer', 'supervisor'] },
    { to: 'DUPLICATE', roles: ['officer', 'supervisor'], reasonRequired: true, dupRequired: true },
    { to: 'REJECTED', roles: ['officer', 'supervisor'], reasonRequired: true },
    { to: 'WITHDRAWN', roles: ['citizen'], guard: 'within24h' },
  ],
  TRIAGE: [
    { to: 'NEEDS_INFO', roles: ['officer', 'supervisor'], reasonRequired: true },
    { to: 'DUPLICATE', roles: ['officer', 'supervisor'], reasonRequired: true, dupRequired: true },
    { to: 'REJECTED', roles: ['officer', 'supervisor'], reasonRequired: true },
    { to: 'VERIFIED_FIR', roles: ['officer', 'supervisor'], reasonRequired: true, firRequired: true },
    { to: 'CLOSED_NO_ACTION', roles: ['officer', 'supervisor'], reasonRequired: true },
    { to: 'WITHDRAWN', roles: ['citizen'], guard: 'within24h' },
  ],
  NEEDS_INFO: [
    { to: 'TRIAGE', roles: ['citizen', 'officer', 'supervisor'] },
    { to: 'REJECTED', roles: ['system'], guard: 'after7d', reasonRequired: true },
  ],
  /* Reopening a closed report is a supervisor decision in every case. An officer
     who mis-triaged asks; they do not quietly undo. */
  DUPLICATE: [{ to: 'TRIAGE', roles: ['supervisor'], reasonRequired: true }],
  REJECTED: [{ to: 'TRIAGE', roles: ['supervisor'], reasonRequired: true }],
  CLOSED_NO_ACTION: [{ to: 'TRIAGE', roles: ['supervisor'], reasonRequired: true }],
  VERIFIED_FIR: [
    { to: 'TRIAGE', roles: ['supervisor'], guard: 'notSealed', reasonRequired: true },
  ],
  WITHDRAWN: [],
}

export const TERMINAL_STATUSES: readonly ReportStatus[] = ['WITHDRAWN']

/** Statuses an officer works through, in queue order. */
export const OPEN_STATUSES: readonly ReportStatus[] = ['SUBMITTED', 'TRIAGE', 'NEEDS_INFO']

export interface GuardContext {
  submittedAt?: string
  exportedAt?: string | null
  lastEventAt?: string
  now?: Date
}

function hoursSince(iso: string | undefined, now: Date): number {
  if (!iso) return Infinity
  const t = Date.parse(iso)
  return Number.isNaN(t) ? Infinity : (now.getTime() - t) / 3_600_000
}

export function guardSatisfied(guard: Guard | undefined, ctx: GuardContext = {}): boolean {
  if (!guard) return true
  const now = ctx.now ?? new Date()
  switch (guard) {
    case 'within24h':
      return hoursSince(ctx.submittedAt, now) <= 24
    case 'notSealed':
      return !ctx.exportedAt
    case 'after7d':
      return hoursSince(ctx.lastEventAt, now) >= 24 * 7
  }
}

export function findTransition(
  from: ReportStatus,
  to: ReportStatus,
): Transition | undefined {
  return TRANSITIONS[from]?.find((t) => t.to === to)
}

/** Every move the given role may make right now, guards already applied. */
export function allowedTransitions(
  from: ReportStatus,
  role: Role,
  ctx: GuardContext = {},
): Transition[] {
  return (TRANSITIONS[from] ?? []).filter(
    (t) => t.roles.includes(role) && guardSatisfied(t.guard, ctx),
  )
}

export type TransitionRejection =
  | 'ILLEGAL_TRANSITION'
  | 'FORBIDDEN'
  | 'SEALED'
  | 'VALIDATION'

/** Returns null when the move is legal, otherwise why it is not. The server
    returns the same codes, so the UI never has to guess. */
export function checkTransition(
  from: ReportStatus,
  to: ReportStatus,
  role: Role,
  ctx: GuardContext = {},
  fields: { reasonCode?: string; firNumber?: string; dupOf?: string } = {},
): TransitionRejection | null {
  const t = findTransition(from, to)
  if (!t) return 'ILLEGAL_TRANSITION'
  if (!t.roles.includes(role)) return 'FORBIDDEN'
  if (!guardSatisfied(t.guard, ctx)) {
    return t.guard === 'notSealed' ? 'SEALED' : 'FORBIDDEN'
  }
  if (t.reasonRequired && !fields.reasonCode) return 'VALIDATION'
  if (t.firRequired && !fields.firNumber) return 'VALIDATION'
  if (t.dupRequired && !fields.dupOf) return 'VALIDATION'
  return null
}

/* Reason codes are an enum, not free text, so the citizen-facing timeline can be
   translated. Officer notes stay internal and are never shown to a reporter. */
export const REASON_CODES = [
  'insufficient_detail',
  'outside_jurisdiction',
  'duplicate_of',
  'not_a_crime',
  'unverifiable',
  'no_response',
  'verified_on_site',
  'referred_elsewhere',
  'supervisor_reopen',
] as const

export type ReasonCode = (typeof REASON_CODES)[number]
