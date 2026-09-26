/* ==========================================================================
   CALIBER 02 — GEAR MATRIX

   Layout is computed rather than hand-placed, because the gears have to
   actually mesh: the centre distance between two meshing gears is the sum of
   their tip radii. Get that wrong and the diagram reads as two circles that
   happen to be near each other.

   Two orientations are generated from the same tooth counts:
     - horizontal on wide screens, the train running left to right
     - vertical on narrow screens, the train running down the page
   Neither is the other scaled down.
   ========================================================================== */

import { gearOutline, gearBody, type GearSpec } from '../../lib/gearPath'
import { meshRateDegPerSec } from '../../lib/format'
import { modules, relations } from '../../data/calibration'

export type Orientation = 'horizontal' | 'vertical'

/**
 * Radius of the tooth tips, per tooth. The visual module size.
 *
 * This is the quantity that decides whether the diagram is worth animating. A
 * wheel of 24 teeth at this size has teeth about 15 degrees apart, so a step of
 * 0.5 degrees is roughly a thirtieth of a tooth and cannot be seen; anything
 * finer is a redundant write. It is set so that most wheels cross that quantum
 * only a few times a second, which is why the rotation loop writes so little.
 */
const R_PER_TOOTH = 4
/**
 * Narrow screens get a smaller module. A vertical train is already
 * 2 x the sum of the tip radii tall; at the horizontal module size it becomes
 * a column taller than the viewport.
 */
const R_PER_TOOTH_V = 3

/**
 * Degrees per second of the driving wheel, at unit activity.
 *
 * This sets the whole train's rotation rate. It is a display parameter of the
 * visualisation, chosen to be slow enough to read as machinery rather than as a
 * blur. The rates of every other wheel follow from the meshing relation, so
 * this one number determines all four.
 */
export const TRAIN_BASE_RATE = 6

export type TechNode = {
  id: string
  label: string
  moduleId: string
  /** Anchor point of the component marker. */
  x: number
  y: number
  /** Whether the plate is centred on x or extends to the right of it. */
  anchor: 'center' | 'start'
}

export type GearNode = {
  id: string
  label: string
  role: string
  teeth: number
  cx: number
  cy: number
  tipRadius: number
  rootRadius: number
  /** Signed rotation in degrees per second at unit drive. */
  rate: number
}

export type Layout = {
  width: number
  height: number
  gears: GearNode[]
  techs: TechNode[]
  orientation: Orientation
  /** Y of the label rail, shared by every module. */
  labelY: number
  /** Y at which every component stack begins. */
  railY: number
  /** Left edge of the label/component column. Vertical only; 0 otherwise. */
  columnX: number
}

const PAD = 18
/** Vertical gap between a gear's edge and the component rail. */
const RAIL_GAP = 24
const TECH_ROW = 19
/** Height of the label rail above the tallest wheel. */
const LABEL_BAND = 30
/** Half the width of a component plate, in diagram units. */
const PLATE_HALF = 31

export function computeLayout(orientation: Orientation): Layout {
  const horizontal = orientation === 'horizontal'
  const rpt = horizontal ? R_PER_TOOTH : R_PER_TOOTH_V
  const tips = modules.map((m) => m.teeth * rpt)

  /* --- Position the gears along the train ---
     Two gears in mesh are in contact when their centre distance equals the sum
     of their tip radii. Because the horizontal train is staggered vertically,
     that distance is the hypotenuse, so the horizontal pitch has to be derived
     from it rather than set to the sum of radii directly. Setting x to the sum
     of radii while also offsetting y leaves the teeth visibly short of each
     other. The vertical train has no stagger, so its pitch is the sum. */
  const centres: { x: number; y: number }[] = []

  /* The vertical train's label and component column. Measured from the RIGHT
     EDGE of the widest wheel, not from the origin: the wheels share one centre
     line, so the widest wheel's edge is what the column must clear. Aligning
     each label to its own wheel instead would step the column in and out and
     drop every label after the first onto the wheel above it. */
  const columnX = horizontal ? 0 : tips[0] + Math.max(...tips) + 20

  if (horizontal) {
    // A gentle vertical stagger, as a real train is laid out to fit a plate.
    // The vertical offsets are aesthetic; the spacing that follows is exact.
    const stagger = [0, 16, -10, 12]
    const baseY = LABEL_BAND + Math.max(...tips) + 14
    let x = PAD + tips[0]
    for (let i = 0; i < modules.length; i++) {
      centres.push({ x, y: baseY + (stagger[i] ?? 0) })
      if (i + 1 < modules.length) {
        const dy = (stagger[i + 1] ?? 0) - (stagger[i] ?? 0)
        const contact = tips[i] + tips[i + 1]
        const dySq = Math.min(dy * dy, contact * contact * 0.9)
        x += Math.sqrt(contact * contact - dySq)
      }
    }
  } else {
    let y = PAD + tips[0]
    for (let i = 0; i < modules.length; i++) {
      centres.push({ x: tips[0], y })
      y += tips[i] + tips[i + 1]
    }
  }

  /* --- Rotation rates, from the meshing relation ---
     Each gear turns opposite to the one driving it, at a rate inversely
     proportional to their tooth counts. */
  const rates: number[] = [TRAIN_BASE_RATE]
  for (let i = 1; i < modules.length; i++) {
    rates.push(meshRateDegPerSec(modules[i - 1].teeth, modules[i].teeth, rates[i - 1]))
  }

  const gears: GearNode[] = modules.map((m, i) => ({
    id: m.id,
    label: m.label,
    role: m.role,
    teeth: m.teeth,
    cx: centres[i].x,
    cy: centres[i].y,
    tipRadius: tips[i],
    rootRadius: tips[i] - Math.max(7, tips[i] * 0.14),
    rate: rates[i],
  }))

  /* --- Labels and components ---
     Horizontal: module names share one rail above the train, and every
     component stack begins on one shared line below it.
     Vertical: there is no room for either, because the next wheel sits directly
     below. The name sits inline to the right of its wheel and the components
     stack beneath it, forming a column that reads like a parts list. */
  const labelY = horizontal ? 20 : 0

  // The horizontal component rail, below the lowest wheel.
  const railTop = Math.max(...gears.map((g) => g.cy + g.tipRadius)) + RAIL_GAP

  const techs: TechNode[] = []
  for (let i = 0; i < modules.length; i++) {
    const g = gears[i]
    for (let j = 0; j < modules[i].techs.length; j++) {
      const t = modules[i].techs[j]
      techs.push(
        horizontal
          ? {
              id: t.id,
              label: t.label,
              moduleId: g.id,
              x: g.cx,
              y: railTop + j * TECH_ROW,
              anchor: 'center',
            }
          : {
              id: t.id,
              label: t.label,
              moduleId: g.id,
              x: columnX,
              y: techTop(g) + 22 + j * TECH_ROW,
              anchor: 'start',
            },
      )
    }
  }

  /* --- Extents, measured from what was actually placed --- */
  let maxX = 0
  let maxY = 0
  for (const g of gears) {
    maxX = Math.max(maxX, g.cx + g.tipRadius)
    maxY = Math.max(maxY, g.cy + g.tipRadius)
  }
  for (const t of techs) {
    maxX = Math.max(maxX, t.anchor === 'center' ? t.x + PLATE_HALF : t.x + PLATE_HALF * 2)
    maxY = Math.max(maxY, t.y + (t.anchor === 'center' ? 8 : 0))
  }
  if (!horizontal) {
    // Room for the inline module names, the longest of which is
    // INFRASTRUCTURE.
    maxX = Math.max(maxX, columnX + 130)
  }

  return {
    width: Math.ceil(maxX + PAD),
    height: Math.ceil(maxY + PAD + 4),
    gears,
    techs,
    orientation,
    labelY,
    railY: railTop,
    columnX,
  }
}

/**
 * Top of a gear's component stack, vertical orientation. Derived from the
 * GEOMETRY so the name, the tooth count and the components cannot disagree: as
 * the wheels shrink down the train, each stack starts higher, which is exactly
 * what keeps INFRASTRUCTURE clear of the wheel above it.
 */
export function techTop(g: GearNode): number {
  return g.cy - g.tipRadius + 8
}

/** The toothed outline and the spoked body, for one gear. */
export function gearGeometry(g: GearNode): { spec: GearSpec; outline: string; body: string } {
  const spec: GearSpec = {
    cx: g.cx,
    cy: g.cy,
    teeth: g.teeth,
    tipRadius: g.tipRadius,
    toothDepth: g.tipRadius - g.rootRadius,
    // Fewer, wider teeth on the small wheels so they do not turn to mush.
    tipWidth: g.teeth <= 14 ? 0.5 : 0.44,
    spokes: g.teeth >= 18 ? 5 : 4,
    hubRatio: 0.2,
    rimRatio: 0.74,
  }
  return { spec, outline: gearOutline(spec), body: gearBody(spec) }
}

/* --------------------------------------------------------------------------
   Leader lines
   A technical-drawing callout: an elbowed line from the source component to
   the target, with a small terminator. Not a curved bezier — a leader in a
   drawing is orthogonal, and straight lines read as drafted rather than
   decorated.
   -------------------------------------------------------------------------- */

export type Leader = {
  from: TechNode
  to: TechNode
  label: string
  kind: 'within' | 'across'
  d: string
  /** Midpoint of the horizontal run, where the label is placed. */
  lx: number
  ly: number
}

/** The horizontal centre of a component plate, given its anchor. */
function plateCentre(n: TechNode): number {
  return n.anchor === 'center' ? n.x : n.x + PLATE_HALF
}

export function computeLeaders(layout: Layout, activeId: string | null): Leader[] {
  if (!activeId) return []
  const byId = new Map(layout.techs.map((t) => [t.id, t]))

  return relations
    .filter((r) => r.from === activeId || r.to === activeId)
    .map((r) => {
      const a = byId.get(r.from)
      const b = byId.get(r.to)
      if (!a || !b) return null

      const ax = plateCentre(a)
      const bx = plateCentre(b)
      // Anchor points on the plate edges, so the line does not disappear under
      // the label.
      const horizontal = Math.abs(bx - ax) >= Math.abs(b.y - a.y)
      let d: string
      let lx: number
      let ly: number

      if (horizontal) {
        const dir = bx >= ax ? 1 : -1
        const x1 = ax + dir * (PLATE_HALF + 3)
        const x2 = bx - dir * (PLATE_HALF + 3)
        const midY = (a.y + b.y) / 2
        // Elbow: out, across, in.
        d = `M ${ax} ${a.y} L ${x1} ${a.y} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${b.y} L ${bx} ${b.y}`
        lx = (x1 + x2) / 2
        ly = midY - 4
      } else {
        const dir = b.y >= a.y ? 1 : -1
        const y1 = a.y + dir * 9
        const y2 = b.y - dir * 9
        const midX = (ax + bx) / 2
        d = `M ${ax} ${a.y} L ${ax} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${bx} ${y2} L ${bx} ${b.y}`
        lx = midX
        ly = (y1 + y2) / 2 - 4
      }

      return { from: a, to: b, label: r.label, kind: r.kind, d, lx, ly }
    })
    .filter((l): l is Leader => l !== null)
}

/** Small terminator drawn at the far end of a leader. */
export function terminator(node: TechNode, orientation: Orientation): string {
  return orientation === 'horizontal'
    ? `M ${plateCentre(node) - 2.5} ${node.y - 5} L ${plateCentre(node) + 2.5} ${node.y + 5}`
    : `M ${node.x - 5} ${node.y - 2.5} L ${node.x + 5} ${node.y + 2.5}`
}

/* Module labels are placed against the shared label rail, not against a point
   on a gear's rim, so no rim helper is needed. */
