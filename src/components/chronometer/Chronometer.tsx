import { useCallback, useRef, useState } from 'react'
import { Dial } from './Dial'
import { useFrameRef, useMovement } from '../../hooks/useMovementClock'
import { formatStopwatch, formatRate } from '../../lib/format'
import { tachymeterReading, CALIBER } from '../../lib/timekeeping'
import { play } from '../../lib/audio'
import './chronometer.css'

type ChronoState = 'idle' | 'running' | 'stopped'

const STATE_LABEL: Record<ChronoState, string> = {
  idle: 'READY',
  running: 'RUNNING',
  stopped: 'STOPPED',
}

/**
 * The instrument: dial plus chronograph register.
 *
 * The chronograph is a real stopwatch. Its elapsed time comes from the
 * timekeeper's monotonic accumulator and nothing else — no scroll input, no
 * frame rate, no animation state can influence it. The tachymeter printed on
 * the bezel reads that same elapsed time, so the scale on the dial and the
 * number in the register can never disagree.
 */
export function Chronometer() {
  const { timekeeper, motionAllowed } = useMovement()
  const [state, setState] = useState<ChronoState>('idle')

  const elapsedRef = useRef<HTMLSpanElement>(null)
  const rateRef = useRef<HTMLSpanElement>(null)

  // Reduced-motion readers see a 1 Hz seconds hand rather than the caliber's
  // 5 Hz. The time is identical; only the display cadence changes.
  const stepRate = motionAllowed ? CALIBER.handStepHz : 1

  /* Scroll activity, kept in a ref so the frame loop can read it without
     waking React. It is read ONLY for visual amplitude inside the dial. */
  const driveRef = useRef(0)
  useFrameRef((f) => {
    driveRef.current = f.drive
  })

  useFrameRef((f) => {
    const ms = f.chronoMs

    if (elapsedRef.current) {
      const next = formatStopwatch(ms)
      if (elapsedRef.current.textContent !== next) elapsedRef.current.textContent = next
    }
    if (rateRef.current) {
      // A rate is only meaningful past one second, and is explicitly null below
      // that rather than being shown as an implausible number.
      const next = formatRate(tachymeterReading(ms))
      if (rateRef.current.textContent !== next) rateRef.current.textContent = next
    }
  })

  const toggle = useCallback(() => {
    const next = timekeeper.toggleChrono()
    setState(next)
    play(next === 'running' ? 'tick' : 'clack')
  }, [timekeeper])

  const reset = useCallback(() => {
    if (timekeeper.chronoState === 'running') return
    timekeeper.resetChrono()
    setState('idle')
    play('clack')
  }, [timekeeper])

  return (
    <div className="chrono" style={{ '--size': 'var(--chrono-size, 420px)' } as React.CSSProperties}>
      <Dial chronoRunning={state === 'running'} stepRate={stepRate} driveRef={driveRef} />
      <div className="register" role="group" aria-label="Chronograph">
        <div className="register__row">
          <span className="lbl">CHRONOGRAPH</span>
          <span className="lbl" data-state={state}>
            {STATE_LABEL[state]}
          </span>
        </div>

        {/* role="timer" is the correct semantic: a value that updates
            continuously and must not interrupt a screen reader. */}
        <div className="register__row">
          <span className="lbl">ELAPSED</span>
          <span
            className={`register__value register__value--${state}`}
            ref={elapsedRef}
            role="timer"
            aria-label="Chronograph elapsed time"
          >
            00.00
          </span>
        </div>

        <div className="register__aux">
          <div className="register__aux-cell">
            <span className="lbl">TACHY</span>
            <span className="register__aux-value">
              <span ref={rateRef}>—</span>
              <span className="register__aux-unit"> /HR</span>
            </span>
          </div>
          <div className="register__aux-cell">
            <span className="lbl">HAND STEP</span>
            <span className="register__aux-value">{stepRate} /SEC</span>
          </div>
        </div>

        <div className="pusher">
          <button
            type="button"
            className="pusher__btn pusher__btn--primary"
            onClick={toggle}
            aria-pressed={state === 'running'}
          >
            <span className="pusher__label">{state === 'running' ? 'STOP' : 'START'}</span>
            <span className="pusher__hint">pusher 1</span>
          </button>
          <button
            type="button"
            className="pusher__btn"
            onClick={reset}
            disabled={state !== 'stopped'}
          >
            <span className="pusher__label">RESET</span>
            <span className="pusher__hint">pusher 2</span>
          </button>
        </div>
      </div>
    </div>
  )
}
