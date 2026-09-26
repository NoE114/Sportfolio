/* ==========================================================================
   ACTIVITY — the cosmetic mechanical-activity domain.

   DESIGN RULE (deliberate, load-bearing):
   This module also imports nothing from `timekeeping.ts`. It is the mirror
   image of the guarantee above: there is no code path by which scroll state
   could reach a measurement.

   Its single output is `drive`, a normalised 0..1 scalar describing how
   energetically the movement is currently being worked. `drive` may only be
   used to modulate *visual amplitude*:

     - balance wheel visual swing
     - gear train rotational intensity
     - rotor activity
     - the transient power-load indicator

   It must never be used to compute time, elapsed duration, a reading, a
   rate, or any state that the user could interpret as a measurement.

   When the user stops scrolling, `drive` decays to exactly zero and the
   mechanism comes to rest. It does not "wind up" anything, and it does not
   recover any stored quantity — there is nothing stored here to recover.
   ========================================================================== */

/**
 * Scroll velocity at which the movement is considered fully worked.
 * 3000 px/s is a hard sprint. This is a display normalisation chosen so the
 * response saturates before the input becomes unpleasant — it is a tuning
 * constant for the visual, not a measurement.
 */
const SATURATION_PX_PER_SEC = 3000

/** Time constant of the spin-down, in seconds. */
const DECAY_TAU = 0.35

export class ActivityDomain {
  #lastScrollY = 0
  #lastScrollAt = 0
  /** Normalised mechanical activity, 0..1. */
  #drive = 0
  /** Instantaneous raw scroll velocity in px/s, for diagnostics only. */
  #velocity = 0
  #motionAllowed: boolean
  #started = false

  constructor(motionAllowed: boolean) {
    this.#motionAllowed = motionAllowed
  }

  /**
   * Re-evaluate whether motion is permitted. When the reader prefers reduced
   * motion the mechanism is simply held at rest — the clock is unaffected,
   * because the clock does not live here.
   */
  setMotionAllowed(allowed: boolean): void {
    this.#motionAllowed = allowed
    if (!allowed) {
      this.#drive = 0
      this.#velocity = 0
    }
  }

  get drive(): number {
    return this.#drive
  }

  get velocity(): number {
    return this.#velocity
  }

  /** True when the mechanism is visibly working. */
  get engaged(): boolean {
    return this.#drive > 0.004
  }

  /** Attach to the window. Returns a teardown function. */
  attach(): () => void {
    if (this.#started) return () => {}
    this.#started = true
    this.#lastScrollY = window.scrollY
    this.#lastScrollAt = performance.now()

    const onScroll = () => {
      const now = performance.now()
      const y = window.scrollY
      const dt = (now - this.#lastScrollAt) / 1000
      // Guard the first event and any multi-second gap between events, where a
      // raw division would produce an absurd velocity spike.
      if (dt > 0.0005 && dt < 0.25) {
        const v = Math.abs(y - this.#lastScrollY) / dt
        this.#velocity = v
        if (this.#motionAllowed) {
          const normalised = Math.min(1, v / SATURATION_PX_PER_SEC)
          // Rise fast, so the mechanism responds immediately to intent.
          if (normalised > this.#drive) this.#drive = normalised
        }
      }
      this.#lastScrollY = y
      this.#lastScrollAt = now
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      this.#started = false
    }
  }

  /**
   * Advance the decay. Call once per animation frame.
   * Exponential decay toward zero, so the mechanism spins down like a real
   * weighted wheel rather than stopping abruptly.
   */
  sample(nowMs: number): void {
    // Always advance the reference, including when motion is disallowed, so
    // that re-enabling motion never produces one huge decay step.
    const dt = this.#lastSample === 0 ? 0 : (nowMs - this.#lastSample) / 1000
    this.#lastSample = nowMs

    if (!this.#motionAllowed) {
      this.#drive = 0
      return
    }
    if (dt > 0 && dt < 0.5) {
      this.#drive *= Math.exp(-dt / DECAY_TAU)
      if (this.#drive < 0.0005) this.#drive = 0
    }
  }

  #lastSample = 0
}
