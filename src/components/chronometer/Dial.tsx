import { memo, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { handAngle, quantiseToBeat } from '../../lib/format'
import { polar, handPath, circlePath } from '../../lib/gearPath'
import { buildGraduations } from '../../lib/tachymeter'
import { useFrameRef } from '../../hooks/useMovementClock'
import { CALIBER } from '../../lib/timekeeping'

/* Dial geometry, in the 400×400 viewBox. */
const C = 200
const R_FACE = 172
const R_CASE = 197
const R_BEZEL_OUT = 194
const R_BEZEL_IN = 176
const R_TACHY = 190
const R_TICK_OUT = 168
const R_TICK_IN = 161
const R_INDEX_OUT = 170
const R_INDEX_IN = 151
const APERTURE = { y: 292, r: 33 }
const DATE = { x: 292, y: C, w: 30, h: 20 }

/**
 * The seconds hand advances once per beat rather than continuously. This is
 * derived FROM real elapsed time — the beat decides only the granularity at
 * which that time is displayed. It is also why the balance wheel in the
 * aperture is not decoration: it is the visible cause of the stepping.
 */
function secondAngle(date: Date, stepRate: number): number {
  const ms = date.getSeconds() * 1000 + date.getMilliseconds() + date.getMinutes() * 60_000
  return quantiseToBeat(handAngle(60_000, ms), stepRate)
}

export type DialProps = {
  /** True while the chronograph is running, which hands are live. */
  chronoRunning: boolean
  /**
   * Effective hand step rate. Reduced-motion readers get 1 Hz instead of the
   * caliber's 5 Hz: still a working clock, without five steps a second. The
   * time shown is identical either way.
   */
  stepRate: number
  /** Scroll-derived activity, 0..1. Read for visual amplitude only. */
  driveRef: RefObject<number>
}

export const Dial = memo(function Dial({ chronoRunning, stepRate, driveRef }: DialProps) {
  const hourRef = useRef<SVGGElement>(null)
  const minuteRef = useRef<SVGGElement>(null)
  const secondRef = useRef<SVGGElement>(null)
  const chronoRef = useRef<SVGGElement>(null)
  const balanceRef = useRef<SVGGElement>(null)
  const dateRef = useRef<SVGTextElement>(null)

  /** Last written value per rotating element, for the change guard. */
  const written = useRef<number[]>([NaN, NaN, NaN, NaN, NaN])

  /* --- Static geometry, generated once --------------------------------- */
  const geo = useMemo(() => {
    // Chapter ring: 60 graduations, every fifth one heavier.
    const ticks = Array.from({ length: 60 }, (_, i) => {
      const major = i % 5 === 0
      const [x1, y1] = polar(C, C, R_TICK_OUT, i * 6)
      const [x2, y2] = polar(C, C, major ? R_TICK_IN : R_TICK_IN + 2.5, i * 6)
      return (
        <line
          key={`t${i}`}
          className={major ? 'chrono__tick chrono__tick--5' : 'chrono__tick'}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
        />
      )
    })

    // Applied indices. A double baton at twelve, the rest single — the
    // convention that locates the dial's origin without spending a numeral.
    const indices = Array.from({ length: 12 }, (_, h) => {
      if (h === 0) {
        return [-3.4, 3.4].map((off, k) => {
          const [x1, y1] = polar(C, C, R_INDEX_OUT, off)
          const [x2, y2] = polar(C, C, R_INDEX_IN, off)
          return (
            <line
              key={`i12-${k}`}
              className="chrono__index chrono__index--12"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          )
        })
      }
      const [x1, y1] = polar(C, C, R_INDEX_OUT, h * 30)
      const [x2, y2] = polar(C, C, R_INDEX_IN, h * 30)
      return (
        <line
          key={`i${h}`}
          className="chrono__index"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
        />
      )
    })

    return {
      ticks,
      indices,
      graduations: buildGraduations(C, C, R_TACHY),
      hourPath: handPath(102, 4.2, 2.6, 20),
      minutePath: handPath(144, 3.2, 1.9, 22),
      secondPath: handPath(164, 1.5, 0.8, 46),
      balanceRim: circlePath(0, 0, 22, true),
    }
  }, [])

  /* --- Per-frame writes ------------------------------------------------
     Rotation uses the SVG transform attribute with an explicit pivot rather
     than a CSS transform, so the rotation is unambiguous and independent of
     transform-box resolution. */
  useFrameRef((f) => {
    const d = f.now
    const sec = d.getSeconds() + d.getMilliseconds() / 1000
    const min = d.getMinutes() + sec / 60
    const hr = (d.getHours() % 12) + min / 60

    /* Change-guarded. This is the most important optimisation on the page: the
       hour hand moves once an hour, the minute hand once a minute, and the
       beat-quantised seconds hand five times a second — yet all are recomputed
       every frame. Writing an unchanged transform costs a mutation record and a
       style recalculation for nothing.

       Each hand gets its OWN quantum, passed in per call. They differ by orders
       of magnitude: the minute hand advances 0.1 deg/s and the hour hand
       0.0083 deg/s, so a single shared step either rewrites the hour hand sixty
       times a second for a movement of 0.0001 degrees, or is coarse enough to
       make the seconds hand visibly step. Deriving each from its own rate
       yields the coarsest step that is still invisible for that hand. */
    const set = (el: SVGGElement | null, deg: number, slot: number, quantum: number) => {
      if (!el) return
      const steps = Math.round(deg / quantum)
      if (written.current[slot] === steps) return
      written.current[slot] = steps
      el.setAttribute('transform', `rotate(${(steps * quantum).toFixed(3)})`)
    }

    /* Per-hand quanta, chosen from how far each hand actually moves per frame.

       hour   0.0083 deg/s -> a 0.05 deg grid is 6 s of travel, so the hour hand
              is written about once a minute instead of sixty times a second.
       minute 0.1 deg/s    -> 0.2 deg, about two writes a second.
       second beat-quantised to a 6 deg step, so any grid finer than that is
              wasted; 0.5 deg lands exactly on the beat grid.
       chrono free-running, so it gets the same 0.5 deg as the seconds hand. */
    set(hourRef.current, hr * 30, 0, 0.05)
    set(minuteRef.current, min * 6, 1, 0.2)
    set(secondRef.current, secondAngle(d, stepRate), 2, 0.5)
    set(chronoRef.current, handAngle(60_000, f.chronoMs), 3, 0.5)

    if (balanceRef.current) {
      // 18,000 vph is 2.5 Hz full oscillation (a vibration is counted per
      // direction of swing, so one oscillation is two). The base swing is the
      // running state; scroll activity adds amplitude on top and changes
      // nothing else.
      const amp = 24 * (1 + (driveRef.current ?? 0) * 0.4)
      const angle = Math.sin(2 * Math.PI * CALIBER.oscillationHz * (f.t / 1000)) * amp
      const rounded = Math.round(angle)
      if (written.current[4] !== rounded) {
        written.current[4] = rounded
        balanceRef.current.setAttribute('transform', `rotate(${rounded})`)
      }
    }

    if (dateRef.current) {
      const next = String(d.getDate())
      // Change guard: the date turns over once a day, so without this the text
      // node would be touched sixty times a second for nothing.
      if (dateRef.current.textContent !== next) dateRef.current.textContent = next
    }
  })

  return (
    <svg
      className="chrono__dial"
      viewBox="0 0 400 400"
      role="img"
      aria-label="Analog chronometer dial reading the current local time, with a tachymeter bezel, a date aperture, and an open balance wheel at six o'clock."
    >
      <defs>
        {/* Dial recess. The one gradient inside the instrument, 3.5% alpha. */}
        <radialGradient id="dial-recess" cx="50%" cy="40%" r="64%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.035" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
        </radialGradient>
        {/* Sapphire raking reflection. 2% alpha. */}
        <linearGradient id="sapphire" x1="16%" y1="0%" x2="84%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.012" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* --- Case --- */}
      <circle className="chrono__case" cx={C} cy={C} r={R_CASE} />
      <circle className="chrono__case-edge" cx={C} cy={C} r={R_CASE - 0.5} />
      <circle className="chrono__bezel" cx={C} cy={C} r={R_BEZEL_OUT} />
      <circle className="chrono__bezel-inner" cx={C} cy={C} r={R_BEZEL_IN} />

      {/* --- Tachymeter bezel --- */}
      <g aria-hidden="true">
        {geo.graduations.map((g, i) => (
          <line
            key={`g${i}`}
            className={`chrono__tachy-tick chrono__tachy-tick--${g.grade}`}
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
          />
        ))}
        {geo.graduations.map((g, i) =>
          g.label ? (
            <text
              key={`l${i}`}
              className={
                g.grade === 'major' || g.grade === 'start'
                  ? 'chrono__tachy-num chrono__tachy-num--major'
                  : 'chrono__tachy-num'
              }
              x={g.lx}
              y={g.ly}
              transform={`rotate(${g.rotation.toFixed(1)} ${g.lx.toFixed(1)} ${g.ly.toFixed(1)})`}
            >
              {g.label}
            </text>
          ) : null,
        )}
      </g>

      {/* --- Dial face --- */}
      <circle className="chrono__face" cx={C} cy={C} r={R_FACE} />
      <circle className="chrono__recess" cx={C} cy={C} r={R_FACE} />

      {/* --- Graduations and applied indices --- */}
      <g aria-hidden="true">
        {geo.ticks}
        {geo.indices}
      </g>

      {/* --- Engraved markings --- */}
      <g aria-hidden="true">
        <text className="chrono__mark chrono__mark--accent" x={C} y={C - 92}>
          CALIBER 00
        </text>
        <text className="chrono__mark chrono__mark--spec" x={C} y={C - 80}>
          {`${CALIBER.vph.toLocaleString('en-US')} VPH`}
        </text>
        <text className="chrono__mark chrono__mark--spec" x={C} y={C + 108}>
          AUTOMATIC
        </text>
      </g>

      {/* --- Date aperture --- */}
      <g aria-hidden="true">
        <rect
          className="chrono__date-well"
          x={DATE.x - DATE.w / 2}
          y={DATE.y - DATE.h / 2}
          width={DATE.w}
          height={DATE.h}
          rx="1"
        />
        <text ref={dateRef} className="chrono__date" x={DATE.x} y={DATE.y}>
          --
        </text>
      </g>

      {/* --- Open heart: the balance wheel --- */}
      <g aria-hidden="true" transform={`translate(${C} ${APERTURE.y})`}>
        <circle className="chrono__aperture-ring" cx="0" cy="0" r={APERTURE.r} />
        <g ref={balanceRef} className="chrono__balance">
          <path d={geo.balanceRim} />
          {/* Two crossings, as a balance wheel has. */}
          <line className="chrono__balance-spoke" x1="-21" y1="0" x2="21" y2="0" />
          <line className="chrono__balance-spoke" x1="0" y1="-21" x2="0" y2="21" />
          <circle className="chrono__balance-roller" cx="0" cy="0" r="2.6" />
          <circle className="chrono__jewel" cx="11" cy="0" r="1.5" />
        </g>
      </g>

      {/* --- Hands. Local coordinates; the outer group places them. --- */}
      <g transform={`translate(${C} ${C})`}>
        <g ref={hourRef} className="chrono__hand chrono__hand--hour">
          <path d={geo.hourPath} />
        </g>
        <g ref={minuteRef} className="chrono__hand chrono__hand--minute">
          <path d={geo.minutePath} />
        </g>
        <g
          ref={secondRef}
          className="chrono__hand chrono__hand--second"
          opacity={chronoRunning ? 0 : 1}
        >
          <path d={geo.secondPath} />
        </g>
        <g
          ref={chronoRef}
          className="chrono__hand chrono__hand--chrono"
          opacity={chronoRunning ? 1 : 0}
        >
          <path d={geo.secondPath} />
        </g>
        <circle className="chrono__cap" cx="0" cy="0" r="5" />
        <circle className="chrono__cap-core" cx="0" cy="0" r="1.4" />
      </g>

      {/* --- Sapphire --- */}
      <circle className="chrono__sapphire" cx={C} cy={C} r={R_FACE} />
    </svg>
  )
})
