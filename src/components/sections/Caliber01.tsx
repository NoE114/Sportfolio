import { useRef } from 'react'
import { SectionHead, KV, Lamp } from '../ui/Instrument'
import { useFrameRef } from '../../hooks/useMovementClock'
import { formatElapsed, formatMs } from '../../lib/format'
import { specification } from '../../data/calibration'
import { site } from '../../config/site'
import './spec.css'

const PRINCIPLE = ['Build', 'Break', 'Understand', 'Improve'] as const

/**
 * CALIBER 01 — CORE TELEMETRY
 *
 * Presented as a technical specification rather than as a biography. Every
 * field that is not recorded says so, and the two figures at the foot of the
 * sheet are measured live from this browser.
 */
export function Caliber01() {
  const sessionRef = useRef<HTMLSpanElement>(null)
  const frameRef = useRef<HTMLSpanElement>(null)
  const frameAccum = useRef(0)
  const frameWindow = useRef(0)

  useFrameRef((f) => {
    if (sessionRef.current) {
      const next = formatElapsed(f.sessionMs)
      if (sessionRef.current.textContent !== next) sessionRef.current.textContent = next
    }
    // Sampled, for the same reason as the telemetry strip: a figure changing
    // every frame is not readable.
    frameAccum.current += f.frameDelta
    frameWindow.current += 1
    if (frameWindow.current >= 15 && frameRef.current) {
      const mean = frameAccum.current / frameWindow.current
      const next = formatMs(mean)
      if (frameRef.current.textContent !== next) frameRef.current.textContent = next
      frameAccum.current = 0
      frameWindow.current = 0
    }
  })

  return (
    <section className="plate-section" id="caliber-01" aria-labelledby="cal-01-title">
      <div className="shell">
        <SectionHead caliber="01" title="Core telemetry" note="TECHNICAL SPECIFICATION">
          <h2 className="sr-only" id="cal-01-title">
            Core telemetry
          </h2>
        </SectionHead>

        <div className="spec">
          {/* --- The document --- */}
          <div className="sheet">
            <div className="sheet__head">
              <span className="sheet__title">Specification</span>
              <span className="sheet__rev">Rev 00 · Sheet 1 of 1</span>
            </div>

            <dl>
              <KV k="Designation" mono>
                CALIBER 00
              </KV>
              <KV k="Engine">{specification.find((r) => r.key === 'engine')?.value}</KV>
              <KV k="Current focus">{specification.find((r) => r.key === 'focus')?.value}</KV>
              <KV k="Status">{specification.find((r) => r.key === 'status')?.value}</KV>
              <KV k="Interface">{specification.find((r) => r.key === 'interface')?.value}</KV>
              <KV k="Instrumentation">{specification.find((r) => r.key === 'instrumentation')?.value}</KV>
              <KV k="Standards">{specification.find((r) => r.key === 'standards')?.value}</KV>
              <KV k="Operator" mono>
                {site.name}
              </KV>
              <KV k="Location" mono>
                {site.location}
              </KV>
            </dl>
          </div>

          {/* --- The principle, and the live figures --- */}
          <div className="spec__aside">
            <div className="principle">
              <span className="principle__label">Operating principle</span>
              <ol className="principle__steps">
                {PRINCIPLE.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div>
                <Lamp tone="ok">Specification current</Lamp>
              </div>
            </div>

            {/* Two figures genuinely measured from this browser, so the
                specification sheet contains real data and not only prose. */}
            <div className="measured">
              <div className="measured__cell">
                <span className="lbl">Session uptime</span>
                <span className="measured__val" ref={sessionRef}>
                  00:00
                </span>
                <p className="measured__note">
                  Measured from page load with a monotonic timer. Not a claim about anything
                  except this page.
                </p>
              </div>
              <div className="measured__cell">
                <span className="lbl">Frame interval</span>
                <span className="measured__val" ref={frameRef}>
                  —
                </span>
                <p className="measured__note">
                  Mean gap between animation frames, sampled at 4 Hz on your machine right now.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
