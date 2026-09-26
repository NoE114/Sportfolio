/* ==========================================================================
   GEAR GEOMETRY
   Static SVG path generation. Runs once per gear at mount, then the result is
   only ever rotated by a CSS transform — no path is regenerated per frame.

   TOOTH PROFILE
   The flanks are straight rather than true involute. A true involute curve is
   the correct form for a load-bearing gear, but at the scale these are drawn
   the difference is invisible, and the plate is explicitly stamped as a
   schematic. Straight flanks are the honest choice here: they are a
   simplification of a real profile, presented as one.

   WHAT IS NOT SIMPLIFIED
   The meshing relation. Two gears in contact turn in opposite directions at
   rates inversely proportional to their tooth counts. That is enforced in
   format.ts (meshRateDegPerSec) and is what makes the train read as a
   mechanism rather than as spinning shapes.
   ========================================================================== */

/** Polar to Cartesian, angle in degrees clockwise from 12 o'clock. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)]
}

const n = (v: number): string => {
  // Two decimals is below the visible threshold at any rendered size and keeps
  // the path strings short enough to stay cheap.
  return String(Math.round(v * 100) / 100)
}

export type GearSpec = {
  cx: number
  cy: number
  teeth: number
  /** Radius to the tooth tips. */
  tipRadius: number
  /** Tooth depth, tip to root. */
  toothDepth: number
  /** Angular width of the tooth tip, as a fraction of the pitch angle. */
  tipWidth?: number
  /** Spoke count. 0 draws a solid web. */
  spokes?: number
  /** Radius of the central hub, as a fraction of root radius. */
  hubRatio?: number
  /** Radius of the spoke-rim, as a fraction of root radius. */
  rimRatio?: number
}

export type GearPaths = {
  /** Outer toothed outline. */
  outline: string
  /** Inner body outline (rim outer + hub), drawn as separate subpaths. */
  body: string
}

/**
 * Build the toothed outline of a gear as a single closed path.
 */
export function gearOutline(spec: GearSpec): string {
  const { cx, cy, teeth, tipRadius, toothDepth, tipWidth = 0.42 } = spec
  const rootRadius = tipRadius - toothDepth
  const pitch = 360 / teeth
  // Half the pitch sits either side of the tooth centre line; the remainder is
  // the gap along the root circle.
  const halfPitch = pitch / 2
  const tipHalf = (pitch * tipWidth) / 2
  const rootHalf = tipHalf + toothDepth * 0.42

  const parts: string[] = []

  for (let i = 0; i < teeth; i++) {
    const centre = i * pitch
    const gapStart = centre - halfPitch
    const gapEnd = centre - rootHalf
    const tipStart = centre - tipHalf

    // Start of the tooth, on the root circle.
    const [sx, sy] = polar(cx, cy, rootRadius, centre - rootHalf)

    // The path MUST open with a moveto. Emitting the leading root arc first
    // produces a path that begins with an arc command, which every SVG parser
    // rejects — and a rejected path renders as nothing at all.
    if (i === 0) parts.push(`M ${n(sx)} ${n(sy)}`)
    else parts.push(arcOnCircle(cx, cy, rootRadius, gapStart, gapEnd))

    // Flank up to the tip.
    const [fx, fy] = polar(cx, cy, tipRadius, tipStart)
    parts.push(`L ${n(fx)} ${n(fy)}`)

    // Tooth tip.
    parts.push(arcOnCircle(cx, cy, tipRadius, tipStart, centre + tipHalf))

    // Flank back down to the root.
    const [rx, ry] = polar(cx, cy, rootRadius, centre + rootHalf)
    parts.push(`L ${n(rx)} ${n(ry)}`)
  }

  // Close the root gap between the final tooth and the opening point, so the
  // outline returns exactly to where it started rather than leaving a chord.
  const lastRootEnd = (teeth - 1) * pitch + rootHalf
  parts.push(arcOnCircle(cx, cy, rootRadius, lastRootEnd, 360 - rootHalf))
  parts.push('Z')
  return parts.join(' ')
}

/**
 * Build the wheel body: the outer rim, the crossings (spokes), and the hub.
 * Drawn as one path so it can be filled in a single operation.
 */
export function gearBody(spec: GearSpec): string {
  const { cx, cy, toothDepth, spokes = 0, hubRatio = 0.18, rimRatio = 0.78 } = spec
  const rootRadius = spec.tipRadius - toothDepth

  if (spokes === 0) {
    // Solid web, pierced by the hub cut-out.
    const hub = polar(cx, cy, rootRadius * hubRatio, 0)
    return `${circlePath(cx, cy, rootRadius, true)} ${circlePath(hub[0], hub[1], rootRadius * hubRatio * 0.42, false)}`
  }

  const rimInner = rootRadius * rimRatio
  const hubOuter = rootRadius * hubRatio
  const spokeHalfWidthDeg = 360 / spokes / 2 / 8 // narrow crossings

  const parts: string[] = [circlePath(cx, cy, rootRadius, true), circlePath(cx, cy, rimInner, false)]

  for (let i = 0; i < spokes; i++) {
    const centre = (360 / spokes) * i
    const a0 = centre - spokeHalfWidthDeg
    const a1 = centre + spokeHalfWidthDeg
    const [ox1, oy1] = polar(cx, cy, rimInner, a0)
    const [ox2, oy2] = polar(cx, cy, hubOuter, a0)
    const [ox3, oy3] = polar(cx, cy, hubOuter, a1)
    const [ox4, oy4] = polar(cx, cy, rimInner, a1)
    parts.push(`M ${n(ox1)} ${n(oy1)} L ${n(ox2)} ${n(oy2)} L ${n(ox3)} ${n(oy3)} L ${n(ox4)} ${n(oy4)} Z`)
  }

  parts.push(circlePath(cx, cy, hubOuter, true))
  return parts.join(' ')
}

/** A full circle as a path, so it can participate in a fill-rule group. */
export function circlePath(cx: number, cy: number, r: number, reverse = false): string {
  return `M ${n(cx - r)} ${n(cy)} A ${n(r)} ${n(r)} 0 1 ${reverse ? 0 : 1} ${n(cx + r)} ${n(cy)} A ${n(r)} ${n(r)} 0 1 ${reverse ? 0 : 1} ${n(cx - r)} ${n(cy)} Z`
}

/** Arc following a circle between two angles, clockwise. */
function arcOnCircle(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const [x1, y1] = polar(cx, cy, r, fromDeg)
  const [x2, y2] = polar(cx, cy, r, toDeg)
  const delta = toDeg - fromDeg
  if (Math.abs(delta) < 0.01) return `L ${n(x1)} ${n(y1)}`
  const largeArc = Math.abs(delta) > 180 ? 1 : 0
  // Sweep flag 1 = positive angle direction in SVG's coordinate system, which
  // is clockwise on screen because the y axis points down.
  return `A ${n(r)} ${n(r)} 0 ${largeArc} 1 ${n(x2)} ${n(y2)}`
}

/* --------------------------------------------------------------------------
   Small helper geometries used by the dial.
   -------------------------------------------------------------------------- */

/**
 * A watch hand, built in LOCAL coordinates with the pivot at the origin and
 * the hand pointing up (−Y). The caller places it with a translate and rotates
 * it about (0,0), so there is no dependence on `transform-box` or
 * `transform-origin` resolution, which is the usual source of hands that spin
 * around the wrong point.
 *
 * A hand is a simple polygon: two flanks, a tip, and a counterweight tail.
 * `baseHalfWidth` is what gives the hand visible width at the centre — a hand
 * whose flanks converge to a single point reads as a sliver, not a hand.
 */
export function handPath(
  length: number,
  baseHalfWidth: number,
  tipHalfWidth: number,
  tailLength: number,
): string {
  const bw = baseHalfWidth
  const tw = tipHalfWidth
  const tw2 = tailLength
  const bw2 = tailLength > 0 ? baseHalfWidth * 0.72 : 0
  return [
    `M ${n(bw)} 0`,
    `L ${n(tw)} ${n(-length)}`,
    `L ${n(-tw)} ${n(-length)}`,
    `L ${n(-bw)} 0`,
    ...(tw2 > 0 ? [`L ${n(-bw2)} ${n(tw2)}`, `L ${n(bw2)} ${n(tw2)}`] : []),
    'Z',
  ].join(' ')
}

/* --------------------------------------------------------------------------
   An annular sector was needed here for a power-reserve arc. There is no
   power reserve: the brief's own instruction is that scrolling must not
   recharge a stored quantity, since nothing is stored to recharge. The helper
   is therefore not written. The tachymeter does not need it either — its scale
   is built from discrete graduations in tachymeter.ts, which is what a real
   bezel carries.
   -------------------------------------------------------------------------- */
