/* ==========================================================================
   TACHYMETER SCALE

   The printed bezel of an instrument that reads a rate. This is a real
   measurement scale, not decoration — see the derivation in timekeeping.ts.
   Every position here comes from:

       phi_degrees = 21600 / reading        (clockwise from 12 o'clock)

   which is the inverse of the timing relation. The printed value set is the
   conventional one: multiples of ten across the range, with 65 / 75 / 85 / 95
   and 225 / 275 filled in between, which is what makes the gaps legible as a
   scale rather than an arbitrary list of numbers.

   Anchor points this produces, all matching a conventional bezel:
     60 at 12 o'clock · 80 at 9 · 120 at 6 · 200 at 4:48 · 500 at 1:26
   ========================================================================== */

import { polar } from './gearPath'

export type Tick = {
  /** Position on the bezel, degrees clockwise from 12. */
  angle: number
  /** Tick length class. */
  grade: 'major' | 'medium' | 'minor' | 'start'
  /** Present only where a value is actually printed. */
  label: string | null
  /** True where the value is printed, even if the tick itself is minor. */
  printed: boolean
}

/** The conventional printed set across the 60-500 range. */
const PRINTED = [
  500, 400, 350, 300, 275, 250, 225, 200, 190, 180, 170, 160, 150, 140, 130, 120,
  110, 100, 95, 90, 85, 80, 75, 70, 65, 60,
] as const

/** Values drawn with a full-length tick. */
const MAJOR = new Set([500, 400, 300, 200, 120, 100, 60])
/** Values drawn with a half-length tick. */
const MEDIUM = new Set([350, 250, 150])

const RATE_MIN = 60
const RATE_MAX = 500

/** Build the complete scale, ordered by angle for stable rendering. */
export function buildTachymeterScale(): Tick[] {
  const ticks: Tick[] = []
  const seen = new Set<number>()

  const add = (reading: number) => {
    if (reading < RATE_MIN || reading > RATE_MAX) return
    if (seen.has(reading)) return
    seen.add(reading)

    const printed = (PRINTED as readonly number[]).includes(reading)
    const angle = 21_600 / reading

    let grade: Tick['grade'] = 'minor'
    if (reading === 500) grade = 'start'
    else if (MAJOR.has(reading)) grade = 'major'
    else if (MEDIUM.has(reading)) grade = 'medium'

    ticks.push({ angle, grade, label: printed ? String(reading) : null, printed })
  }

  // Every ten across the range, which is the base graduation.
  for (let r = RATE_MIN; r <= RATE_MAX; r += 10) add(r)
  // The filled-in values that fall between the tens.
  for (const r of [65, 75, 85, 95, 225, 275]) add(r)

  return ticks.sort((a, b) => a.angle - b.angle)
}

/** Graduations of the scale, ready to render. */
export type TachyGraduation = {
  angle: number
  grade: Tick['grade']
  /** Outer end of the tick. */
  x1: number
  y1: number
  /** Inner end of the tick. */
  x2: number
  y2: number
  label: string | null
  /** Text anchor position, for the printed numerals. */
  lx: number
  ly: number
  /** Rotation that sets the numeral upright relative to the bezel. */
  rotation: number
}

const GRADE_LENGTH: Record<Tick['grade'], number> = {
  start: 9,
  major: 7,
  medium: 5,
  minor: 3,
}

export function buildGraduations(
  cx: number,
  cy: number,
  outerRadius: number,
): TachyGraduation[] {
  return buildTachymeterScale().map((t) => {
    const len = GRADE_LENGTH[t.grade]
    const inner = outerRadius - len
    const [x1, y1] = polar(cx, cy, outerRadius, t.angle)
    const [x2, y2] = polar(cx, cy, inner, t.angle)
    const [lx, ly] = polar(cx, cy, inner - 6.5, t.angle)
    return {
      angle: t.angle,
      grade: t.grade,
      x1,
      y1,
      x2,
      y2,
      label: t.label,
      lx,
      ly,
      // Numerals read tangentially around the bezel, flipped on the left side
      // so none of them end up upside down.
      rotation: t.angle > 180 ? t.angle + 90 : t.angle - 90,
    }
  })
}

/* --------------------------------------------------------------------------
   The start marker
   The tachymeter is begun at the 500 graduation, which the scale builder
   already emits with the 'start' grade. No exported constant is needed for it,
   and none is provided — an unused export is a claim about the API that
   nothing keeps honest.
   -------------------------------------------------------------------------- */
