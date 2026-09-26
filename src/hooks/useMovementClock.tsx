/* ==========================================================================
   MOVEMENT CLOCK — the single animation frame loop for the entire page.

   WHY ONE LOOP
   A chronometer that runs several independent rAF loops is a chronometer with
   several independent clocks, which is both slower and a lie about its own
   subject. There is exactly one loop. Everything that moves subscribes to it.

   WHY NO REACT STATE
   At 60 Hz, setState would mean 60 reconciliation passes per second for a page
   whose data changes once per second. Nothing here re-renders React. Frame
   data is written straight to the DOM through refs, and each subscriber
   change-guards its own writes so an unchanged value costs nothing.

   The two domains are assembled here but stay separate objects: the loop
   never lets `drive` reach a measurement, and never lets a measurement reach
   `drive`. They merely coexist on the same frame.
   ========================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Timekeeper, CALIBER } from '../lib/timekeeping'
import { ActivityDomain } from '../lib/activity'

export type Frame = {
  /** Monotonic milliseconds since load. */
  t: number
  /** Wall-clock time, corrected against the system clock. */
  now: Date
  /** Milliseconds since load. Real. */
  sessionMs: number
  /** Chronograph elapsed time in ms. Real. Independent of session. */
  chronoMs: number
  /** Real interval between the last two frames, in ms. */
  frameDelta: number
  /**
   * Normalised mechanical activity, 0..1, derived from scroll velocity.
   * COSMETIC ONLY. Permitted to modulate visual amplitude and nothing else.
   */
  drive: number
  /** True while the mechanism is visibly working. */
  engaged: boolean
}

type Subscriber = (f: Frame) => void

class FrameBus {
  #subs = new Set<Subscriber>()
  #raf = 0
  #running = false
  #last = 0

  /** Reused every frame so the loop allocates nothing at 60 Hz. */
  readonly frame: Frame = {
    t: 0,
    now: new Date(),
    sessionMs: 0,
    chronoMs: 0,
    frameDelta: 0,
    drive: 0,
    engaged: false,
  }

  constructor(
    readonly timekeeper: Timekeeper,
    readonly activity: ActivityDomain,
  ) {
    // A chronometer that is not on screen is not keeping time for the reader.
    // Cancelling the frame callback outright is the single largest saving on
    // this page, and it is why no separate idle-timer is needed.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause()
      else this.resume()
    })
  }

  subscribe(fn: Subscriber): () => void {
    this.#subs.add(fn)
    this.resume()
    return () => {
      this.#subs.delete(fn)
      if (this.#subs.size === 0) this.pause()
    }
  }

  resume(): void {
    if (this.#running || this.#subs.size === 0) return
    this.#running = true
    // Reset the frame clock so the first delta back from hidden is not the
    // entire hidden duration.
    this.#last = performance.now()
    this.#raf = requestAnimationFrame(this.#tick)
  }

  pause(): void {
    if (!this.#running) return
    this.#running = false
    cancelAnimationFrame(this.#raf)
  }

  /** Resume after the tab has been hidden. */
  #tick = (t: number): void => {
    this.#raf = requestAnimationFrame(this.#tick)

    const delta = t - this.#last
    this.#last = t

    // The activity domain decays once per frame; it is driven by scroll
    // events but settles on the frame clock, which is what gives the mechanism
    // a mechanical spin-down instead of a hard stop.
    this.activity.sample(t)

    const f = this.frame
    f.t = t
    f.now = new Date(this.timekeeper.accurateNow())
    f.sessionMs = this.timekeeper.sessionElapsed(f.now.getTime())
    f.chronoMs = this.timekeeper.chronoElapsed(f.now.getTime())
    f.frameDelta = delta
    f.drive = this.activity.drive
    f.engaged = this.activity.engaged

    for (const fn of this.#subs) fn(f)
  }
}

type MovementContextValue = {
  bus: FrameBus
  timekeeper: Timekeeper
  /** The cosmetic activity domain. Exposed only so it can be attached. */
  activity: ActivityDomain
  handStepHz: number
  /** The effective motion permission, after any in-page override. */
  motionAllowed: boolean
  /** True when the reader's operating system asks for reduced motion. */
  systemReduces: boolean
  /** Cycle the in-page motion override. */
  toggleMotion: () => void
}

const MovementContext = createContext<MovementContextValue | null>(null)

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

/** Tracks the operating-system motion preference, live. */
function useSystemReducesMotion(): boolean {
  const [reduces, setReduces] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(REDUCE_QUERY).matches
  })

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(REDUCE_QUERY)
    const onChange = () => setReduces(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduces
}

/**
 * An explicit in-page override, in addition to the system preference.
 *
 * The override is three-state so that the reader can always get back to
 * following their system setting, and the effective state is written to
 * `data-motion` on the document element — which is what lets CSS transitions
 * follow exactly the same decision the frame loop makes.
 */
function useMotionOverride() {
  const [override, setOverride] = useState<'system' | 'full' | 'reduced'>('system')
  const systemReduces = useSystemReducesMotion()

  const allowed = override === 'system' ? !systemReduces : override === 'full'

  useEffect(() => {
    document.documentElement.dataset.motion = allowed ? 'full' : 'reduced'
  }, [allowed])

  const toggle = useCallback(() => {
    setOverride((prev) => {
      const effective = prev === 'system' ? !systemReduces : prev === 'full'
      return effective ? 'reduced' : 'full'
    })
  }, [systemReduces])

  return { allowed, systemReduces, toggle }
}

export function MovementProvider({ children }: { children: ReactNode }) {
  const { allowed: motionAllowed, systemReduces, toggle: toggleMotion } = useMotionOverride()

  const value = useMemo<MovementContextValue>(() => {
    const timekeeper = new Timekeeper()
    const activity = new ActivityDomain(motionAllowed)
    const bus = new FrameBus(timekeeper, activity)
    return { bus, timekeeper, activity, handStepHz: CALIBER.handStepHz, motionAllowed, systemReduces, toggleMotion }
    // motionAllowed is applied to the domain by the effect below, not by
    // rebuilding the bus, so that changing the preference never resets time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleMotion])

  // Keep the activity domain's motion permission in step with the preference.
  useEffect(() => {
    value.activity.setMotionAllowed(motionAllowed)
  }, [value, motionAllowed])

  // Scroll listener for the activity domain.
  useEffect(() => value.activity.attach(), [value])

  return <MovementContext.Provider value={value}>{children}</MovementContext.Provider>
}

export function useMovement(): MovementContextValue {
  const ctx = useContext(MovementContext)
  if (!ctx) throw new Error('useMovement must be used within MovementProvider')
  return ctx
}

/**
 * Subscribe to the frame loop. The callback must be stable — wrap it in
 * useCallback, or use useFrameRef to have a ref managed for you.
 */
export function useFrame(fn: Subscriber): void {
  const { bus } = useMovement()
  useEffect(() => bus.subscribe(fn), [bus, fn])
}

/**
 * Subscribe with a ref-managed callback, for when the handler needs to read
 * fresh props without resubscribing on every render.
 */
export function useFrameRef(fn: (f: Frame) => void): void {
  const { bus } = useMovement()
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => bus.subscribe((f) => ref.current(f)), [bus])
}
