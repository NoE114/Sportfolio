/* ==========================================================================
   FORMAT
   Explicit, locale-independent formatters.

   `Intl`/`toLocaleString` is avoided for the readouts on purpose: it is
   comparatively slow to call every frame, and its output varies with the
   reader's locale, which would make a fixed-width instrument readout
   unpredictable. These build strings directly and are stable.

   Every function returns a fixed-width string for a given magnitude, so a
   changing value can never reflow the layout around it.
   ========================================================================== */

const pad = (n: number, width = 2): string => n.toString().padStart(width, '0')

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
const MON_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const

/** `14:32:08.492` — UTC, to the millisecond. */
export function formatUtc(d: Date): string {
  return (
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` +
    `.${pad(d.getUTCMilliseconds(), 3)}`
  )
}

/** `14:32:08` — reader's local time, to the second. */
export function formatLocal(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** `SAT 26 SEP 2026` */
export function formatDate(d: Date): string {
  return (
    `${DAY_ABBR[d.getDay()]} ${pad(d.getDate())} ${MON_ABBR[d.getMonth()]} ${d.getFullYear()}`
  )
}

/** `+02:00` / `UTC-05:00` — the reader's real UTC offset. */
export function formatOffset(d: Date): string {
  // getTimezoneOffset is minutes *behind* UTC, so the sign is inverted.
  const mins = -d.getTimezoneOffset()
  const sign = mins < 0 ? '-' : '+'
  const abs = Math.abs(mins)
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** IANA zone name, e.g. `Europe/Madrid`. `undefined` where unsupported. */
export function timeZoneName(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

/* --- Durations --------------------------------------------------------- */

/**
 * `MM:SS` under an hour, `HH:MM:SS` beyond it. Used for session elapsed.
 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/**
 * `SS.CC` under a minute, `MM:SS.CC` beyond. The chronograph reads to
 * hundredths, which is the convention for an instrument of this class.
 * Below 1 s the hours/minutes group is suppressed rather than shown as `00`,
 * so the readout tightens as it counts rather than sitting in dead space.
 */
export function formatStopwatch(ms: number): string {
  const clamped = Math.max(0, ms)
  const totalCs = Math.floor(clamped / 10)
  const cs = totalCs % 100
  const totalS = Math.floor(totalCs / 100)
  const s = totalS % 60
  const m = Math.floor(totalS / 60)
  return m > 0 ? `${pad(m)}:${pad(s)}.${pad(cs)}` : `${pad(s)}.${pad(cs)}`
}

/** Tachymeter rate, or a dash when below the measurable floor. */
export function formatRate(reading: number | null): string {
  return reading === null ? '—' : String(Math.round(reading))
}

/** Frame interval, one decimal place. */
export function formatMs(ms: number): string {
  return ms.toFixed(1)
}

/**
 * A percentage, for the power-load bar. Rounds to whole numbers so the bar
 * does not shimmer on sub-pixel changes.
 */
export function formatPercent(v: number): string {
  return String(Math.round(v * 100))
}

/* --- Rotational geometry ----------------------------------------------- */

/**
 * Angle in degrees for a hand that completes `periodMs` per revolution.
 * Hand angle is measured clockwise from 12 o'clock, which is the SVG
 * convention once the dial is rotated into place.
 */
export function handAngle(periodMs: number, elapsedMs: number): number {
  return (((elapsedMs % periodMs) / periodMs) * 360 + 360) % 360
}

/**
 * Quantise an angle to the caliber's beat rate, the way a mechanical watch
 * advances: the hand is released once per beat rather than continuously.
 *
 * This is derived FROM real elapsed time — the beat only decides the
 * granularity at which that time is displayed, never the time itself.
 */
export function quantiseToBeat(angleDeg: number, bps: number): number {
  return Math.floor(angleDeg * bps) / bps
}

/* --- Angles for the gear train ---------------------------------------- */

/**
 * Signed rotation for a gear in a meshing pair, degrees per second.
 *
 * Two gears in mesh turn in opposite directions at rates inversely
 * proportional to their tooth counts — that is what makes a gear train a
 * gear train. N1 * w1 = -N2 * w2.
 */
export function meshRateDegPerSec(
  driverTeeth: number,
  drivenTeeth: number,
  driverDegPerSec: number,
): number {
  return -(driverDegPerSec * driverTeeth) / drivenTeeth
}
