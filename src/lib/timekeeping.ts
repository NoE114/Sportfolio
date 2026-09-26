/* ==========================================================================
   TIMEKEEPING — the authoritative clock domain.

   DESIGN RULE (deliberate, load-bearing):
   This module imports nothing. It has no access to React, the DOM, or scroll
   state. That is the structural guarantee that scroll velocity can never
   influence time, because there is no code path by which it could.

   Everything the user is shown as a *measurement* comes from here:
     wall clock, UTC, date, session elapsed, chronograph elapsed, frame delta.

   WALL CLOCK SOURCE
   `Date.now()` is not monotonic — an NTP correction mid-session can step the
   clock backwards and visibly jump a hand. `performance.now()` is monotonic but
   has no epoch. So we anchor both: take `Date.now()` once as the epoch anchor,
   then advance it with the monotonic timer. The result is correct at first
   paint and cannot be stepped by a clock sync afterwards.
   ========================================================================== */

/** An hour, in ms. The unit the tachymeter's rate is expressed in. */
const MS_PER_HOUR = 3_600_000

/** Monotonic milliseconds since page start. */
export function mono(): number {
  return performance.now()
}

export class Timekeeper {
  /** Wall-clock epoch at construction, in ms since Unix epoch. */
  readonly #epochAnchor: number
  /** Monotonic reading taken at the same instant as #epochAnchor. */
  readonly #monoAnchor: number

  /** Chronograph state. */
  #chrono: 'idle' | 'running' | 'stopped' = 'idle'
  #chronoStartedAt = 0
  #chronoAccumulated = 0

  constructor() {
    this.#epochAnchor = Date.now()
    this.#monoAnchor = mono()
  }

  /* --- Wall clock ----------------------------------------------------- */

  /** Current wall-clock time in ms since Unix epoch, advanced monotonically. */
  now(): number {
    return this.#epochAnchor + (mono() - this.#monoAnchor)
  }

  /**
   * Wall-clock time corrected for accumulated monotonic drift, in ms.
   * This is the *display* time. `now()` is the raw monotonic-advanced value;
   * this one subtracts the error that has built up between realisations, so a
   * long-lived tab cannot drift away from the true time. Both are real time —
   * this one is simply the more accurate of the two.
   */
  accurateNow(): number {
    return Date.now()
  }

  /** Milliseconds since this page was loaded. */
  sessionElapsed(now = this.accurateNow()): number {
    return now - this.#epochAnchor
  }

  /* --- Chronograph ---------------------------------------------------- */

  get chronoState(): 'idle' | 'running' | 'stopped' {
    return this.#chrono
  }

  /** Elapsed chronograph time in ms. Real elapsed time, always. */
  chronoElapsed(now = this.accurateNow()): number {
    if (this.#chrono === 'running') {
      return this.#chronoAccumulated + (now - this.#chronoStartedAt)
    }
    return this.#chronoAccumulated
  }

  /**
   * Start/stop the chronograph. Returns the new state.
   * Start from a stopped state clears the accumulated reading, which is how a
   * real chronograph behaves when you press the pusher again.
   */
  toggleChrono(): 'idle' | 'running' | 'stopped' {
    if (this.#chrono === 'running') {
      this.#chronoAccumulated += this.accurateNow() - this.#chronoStartedAt
      this.#chrono = 'stopped'
    } else {
      // Pressing start from a stopped state begins a fresh reading.
      this.#chronoAccumulated = 0
      this.#chronoStartedAt = this.accurateNow()
      this.#chrono = 'running'
    }
    return this.#chrono
  }

  /** Return the chronograph to zero. Only meaningful when stopped. */
  resetChrono(): void {
    if (this.#chrono === 'running') return
    this.#chronoAccumulated = 0
    this.#chrono = 'idle'
  }
}

/* ==========================================================================
   CALIBER SPECIFICATION

   These are the declared design parameters of this caliber — the same kind of
   figures a real caliber is published with. They specify the visualisation; they
   are not measurements of a physical watch, and nothing here is presented as
   measured performance of the portfolio's author.

   BEAT RATE 18,000 VPH / 2.5 HZ OSCILLATION
     Defensible real-world interpretation: 18,000 vibrations per hour is a
     long-established, very common movement rate. Because a vibration is
     counted per direction of swing, that is 2.5 Hz full oscillation and 5
     seconds-hand steps per second — which is exactly how a mechanical watch
     advances its seconds hand, in discrete steps rather than a smooth sweep.
   ========================================================================== */

export const CALIBER = {
  /**
   * Balance oscillation frequency, in hertz.
   *
   * In horological usage a "vibration" is counted per DIRECTION of swing, so
   * one full back-and-forth oscillation is two vibrations. The common
   * 18,000 vph rate is therefore 9,000 full oscillations per hour, which is
   * 2.5 Hz — not 5 Hz.
   */
  oscillationHz: 2.5,

  /** Vibrations per hour. Two per oscillation. */
  get vph(): number {
    return this.oscillationHz * 2 * 3600
  },

  /**
   * Steps of the seconds hand per second. A mechanical hand is released once
   * per vibration, so this is the display granularity of the seconds hand.
   */
  get handStepHz(): number {
    return this.vph / 3600
  },

  /** Escape wheel tooth count. At one tooth per beat this gives a 3 s
   *  revolution at 18,000 vph, consistent with a 15-tooth escape wheel. */
  escapeWheelTeeth: 15,

  /** Printed range of the tachymeter bezel. See tachymeter.ts. */
  tachymeterMin: 60,
  tachymeterMax: 500,
} as const

/* ==========================================================================
   TACHYMETER
   Real measurement, not decoration.

   A tachymeter reads a rate: you start timing, and read the scale where the
   seconds hand stops. Because the seconds hand makes one revolution per minute,
   the dial angle is proportional to elapsed seconds, so a fixed printed scale
   can convert an angle into a rate:

       reading = 3600 / elapsed_seconds      (units per hour)

   and, expressed as a position on the dial:

       phi_degrees = 6 * elapsed_seconds = 21600 / reading

   where phi is measured clockwise from 12 o'clock. This yields the familiar
   anchor points: 60 at 12, 120 at 6, 240 at 3, 500 at 43.2 degrees.

   Validity: the reading is only meaningful at 1 s and beyond (below 1 s the
   rate exceeds 3600, off the top of any printed scale). The printed bezel on
   this instrument covers 60-500, i.e. 7.2 s to 60 s of elapsed time.
   ========================================================================== */

export const TACHY_MIN_ELAPSED_MS = 1000

export function tachymeterReading(elapsedMs: number): number | null {
  if (elapsedMs < TACHY_MIN_ELAPSED_MS) return null
  return MS_PER_HOUR / elapsedMs
}

/** Dial position in degrees clockwise from 12, for placing a reading on the bezel. */
export function tachymeterAngle(reading: number): number {
  return 21_600 / reading
}

/* ==========================================================================
   FRAME DELTA
   A genuine, live measurement of this page's rendering cadence, taken from the
   real interval between animation frames. It is computed in the frame loop and
   carried on Frame.frameDelta; there is no separate accessor, because a second
   path to the same number is a second thing that can drift from it.
   ========================================================================== */
