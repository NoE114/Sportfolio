/* ==========================================================================
   CALIBRATION DATA
   Content for CALIBER 01 (specification sheet) and CALIBER 02 (gear matrix).

   PROVENANCE
   The CALIBER 01 rows below are the values given in the project brief. They
   are defaults to replace, not claims about anyone. Edit freely.

   The CALIBER 02 relations are real, widely-documented relationships between
   technologies (React is built on TypeScript in practice; Docker containers
   run on a Linux kernel; and so on). They are not invented capabilities or
   usage claims — they are the kind of relationship any engineer would confirm.
   ======================================================================== */

/* --------------------------------------------------------------------------
   CALIBER 01 — TECHNICAL SPECIFICATION
   `null` renders as NOT RECORDED.
   -------------------------------------------------------------------------- */

export type SpecRow = {
  key: string
  /** Left column: the specification key. */
  label: string
  /** Right column: the value. */
  value: string | null
}

export const specification: readonly SpecRow[] = [
  { key: 'engine', label: 'ENGINE', value: 'Software / Systems / Web' },
  {
    key: 'principle',
    label: 'OPERATING PRINCIPLE',
    value: 'Build → Break → Understand → Improve',
  },
  { key: 'focus', label: 'CURRENT FOCUS', value: 'Cybersecurity / Systems / Engineering' },
  { key: 'status', label: 'STATUS', value: 'In Development' },
  { key: 'interface', label: 'INTERFACE', value: null },
  { key: 'instrumentation', label: 'INSTRUMENTATION', value: null },
  { key: 'standards', label: 'STANDARDS', value: null },
]

/* --------------------------------------------------------------------------
   CALIBER 02 — GEAR MATRIX

   Four modules, each represented as a gear in a reduction chain. The chain
   order is a build order: you execute, you present it, you operate it, you
   deploy it.

   `teeth` is what makes the schematic mechanically honest — two meshing
   gears turn in opposite directions at rates inversely proportional to their
   tooth counts. The absolute values are arbitrary; the *relation* is enforced
   in the renderer.

   The plate is stamped SCHEMATIC — NOT TO SCALE because the ratios describe
   the layout of this diagram, not a measured machine.
   -------------------------------------------------------------------------- */

export type Tech = {
  id: string
  label: string
  /** Optional short qualifier shown in the callout. */
  note: string | null
}

export type Module = {
  id: string
  label: string
  /** One-line description of the module's role in the chain. */
  role: string
  teeth: number
  techs: readonly Tech[]
}

export const modules: readonly Module[] = [
  {
    id: 'execution',
    label: 'EXECUTION',
    role: 'Where the work is computed',
    teeth: 24,
    techs: [
      { id: 'python', label: 'PYTHON', note: null },
      { id: 'c', label: 'C', note: null },
      { id: 'rust', label: 'RUST', note: null },
      { id: 'go', label: 'GO', note: null },
    ],
  },
  {
    id: 'interface',
    label: 'INTERFACE',
    role: 'What the operator sees',
    teeth: 18,
    techs: [
      { id: 'react', label: 'REACT', note: null },
      { id: 'nextjs', label: 'NEXT.JS', note: null },
      { id: 'typescript', label: 'TYPESCRIPT', note: null },
    ],
  },
  {
    id: 'systems',
    label: 'SYSTEMS',
    role: 'How it is built and versioned',
    teeth: 14,
    techs: [
      { id: 'linux', label: 'LINUX', note: null },
      { id: 'docker', label: 'DOCKER', note: null },
      { id: 'git', label: 'GIT', note: null },
    ],
  },
  {
    id: 'infra',
    label: 'INFRASTRUCTURE',
    role: 'Where it runs',
    teeth: 10,
    techs: [
      { id: 'cloud', label: 'CLOUD', note: null },
      { id: 'apis', label: 'APIS', note: null },
      { id: 'networking', label: 'NETWORKING', note: null },
    ],
  },
]

export type Relation = {
  from: string
  to: string
  /** Shown in the callout when the relation is highlighted. */
  label: string
  /** Same-module relations draw an arc; cross-module relations span the train. */
  kind: 'within' | 'across'
}

export const relations: readonly Relation[] = [
  { from: 'nextjs', to: 'react', label: 'built on', kind: 'within' },
  { from: 'nextjs', to: 'typescript', label: 'typed with', kind: 'within' },
  { from: 'react', to: 'typescript', label: 'typed with', kind: 'within' },

  { from: 'docker', to: 'linux', label: 'containers run on', kind: 'within' },
  { from: 'git', to: 'linux', label: 'developed on', kind: 'within' },

  { from: 'apis', to: 'networking', label: 'traffic over', kind: 'within' },
  { from: 'cloud', to: 'networking', label: 'provisioned over', kind: 'within' },

  { from: 'go', to: 'docker', label: 'packaged by', kind: 'across' },
  { from: 'rust', to: 'cloud', label: 'deployed to', kind: 'across' },
  { from: 'python', to: 'apis', label: 'served by', kind: 'across' },
  { from: 'typescript', to: 'networking', label: 'delivered over', kind: 'across' },
]
