/* ==========================================================================
   SITE IDENTITY
   ---------------------------------------------------------------------------
   FILL THESE IN. Every placeholder is wrapped in [ BRACKETS ] so it is
   greppable — `rg '\[' src/config/site.ts` — and so it renders as a field
   awaiting a value rather than as invented content.

   Nothing in this file is a claim about a person or a project. It is the
   only place identity data lives, so nothing is hardcoded in a component.
   ========================================================================== */

export const site = {
  /** Shown in the hero, nav, and the CALIBER 01 specification sheet. */
  name: '[ OPERATOR NAME ]',
  /** Short role line. Technical, not a job title. */
  role: '[ SOFTWARE / SYSTEMS ENGINEER ]',

  /**
   * A single sentence of positioning. Deliberately not a personality
   * statement — the headline already carries the thesis.
   */
  statement:
    'A portfolio built the way an instrument is built: a stated principle, ' +
    'a measured mechanism, and no claim that cannot be checked.',

  /**
   * IANA zone. Drives the local-time readout and the date. `null` means the
   * reader's own browser zone is used, which is the more honest default.
   */
  timeZone: null as string | null,

  location: '[ CITY, COUNTRY ]',

  /** Free text shown on the calibration plate. Keep it to a real number. */
  yearsOperating: null as number | null,

  links: {
    github: '[ https://github.com/handle ]',
    email: '[ you@example.com ]',
    resume: null as string | null,
    // Populate these only if they resolve. A link that 404s is worse than no
    // link, so absent ones are simply not rendered.
    linkedin: null as string | null,
  },
} as const

/**
 * The headline. Set in the display face at the hero's fluid size, revealed
 * as a mechanical shutter wipe.
 */
export const hero = {
  eyebrow: 'CALIBER 00',
  headline: ['PRECISION', 'OVER PROMISES'],
  /**
   * Primary calls to action. `href` is a page anchor; these are the only
   * navigational elements in the hero.
   */
  actions: [
    { label: 'CHRONO VAULT', href: '#caliber-03', primary: true },
    { label: 'TRANSMIT', href: '#caliber-04', primary: false },
  ],
} as const

/* --------------------------------------------------------------------------
   A note on honesty in the telemetry strip
   --------------------------------------------------------------------------
   Every figure rendered in the telemetry strip is a live measurement taken
   from this browser at runtime: UTC, local time and date from the system
   clock; SESSION from the monotonic timer; FRAME from the real interval
   between animation frames; TRANSPORT from the Network Information API
   where the browser exposes it, and omitted where it does not.

   BUILD is the one static figure. It is the Vite build hash injected by
   Netlify, or `DEV` when running locally. It is never a placeholder string.
   ------------------------------------------------------------------------ */
