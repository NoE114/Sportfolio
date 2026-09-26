/* ==========================================================================
   CHRONO VAULT — project data
   ---------------------------------------------------------------------------
   Every fact-bearing field is `string | null`. `null` is meaningful: it means
   "not recorded", and the UI renders it as a distinct NOT RECORDED state. It
   is never replaced with a plausible-sounding value.

   Structure the brief asks for, in order:
     PROJECT · PURPOSE · STACK · TECHNICAL CHALLENGE · RESULT · METRICS
     LIVE DEMO · SOURCE

   Fill in what you actually know and leave the rest `null`. A project plate
   with four recorded fields and four NOT RECORDED fields is honest and still
   reads as a complete instrument. A plate with invented metrics is not.
   ========================================================================== */

export type Project = {
  /** Stable key, used for the index and as the React key. */
  id: string
  /** Display index, e.g. '01'. */
  index: string
  /** Short title. */
  title: string
  /** Optional one-word classification, shown as an engraved tag. */
  classification: string | null
  /** Year, or null if not recorded. */
  year: number | null

  /** What it is and why it exists. */
  purpose: string | null
  /** Languages, frameworks, tools. */
  stack: readonly string[] | null
  /** The hard part. Usually the most interesting thing on the plate. */
  challenge: string | null
  /** What came out of it, in plain terms. */
  result: string | null

  /**
   * Quantitative outcomes. Strictly measured, real numbers with units.
   * `label` and `value` are both required so a bare number can never be
   * displayed without saying what it measures.
   */
  metrics: readonly { label: string; value: string }[] | null

  /** Live URL, or null. Rendered only when present. */
  demo: string | null
  /** Source repository, or null. Rendered only when present. */
  source: string | null

  /** Optional longer body copy for the plate's lower section. */
  notes: string | null
}

/* --------------------------------------------------------------------------
   Three plates, fully structured, nothing recorded.

   The `title` fields below are placeholders in the same bracketed convention
   as config/site.ts, so the vault has correct structure and honest emptiness.
   Replace them with your real projects.
   -------------------------------------------------------------------------- */

export const projects: readonly Project[] = [
  {
    id: 'project-01',
    index: '01',
    title: '[ PROJECT ONE ]',
    classification: null,
    year: null,
    purpose: null,
    stack: null,
    challenge: null,
    result: null,
    metrics: null,
    demo: null,
    source: null,
    notes: null,
  },
  {
    id: 'project-02',
    index: '02',
    title: '[ PROJECT TWO ]',
    classification: null,
    year: null,
    purpose: null,
    stack: null,
    challenge: null,
    result: null,
    metrics: null,
    demo: null,
    source: null,
    notes: null,
  },
  {
    id: 'project-03',
    index: '03',
    title: '[ PROJECT THREE ]',
    classification: null,
    year: null,
    purpose: null,
    stack: null,
    challenge: null,
    result: null,
    metrics: null,
    demo: null,
    source: null,
    notes: null,
  },
]

/** Total recorded fields across the vault, shown on the plate header. */
export function recordedFieldCount(): number {
  return projects.reduce((n, p) => {
    let c = 0
    if (p.purpose) c++
    if (p.stack?.length) c++
    if (p.challenge) c++
    if (p.result) c++
    if (p.metrics?.length) c++
    if (p.demo) c++
    if (p.source) c++
    return n + c
  }, 0)
}

export const TOTAL_PROJECT_FIELDS = projects.length * 7
