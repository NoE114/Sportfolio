import { useEffect, useRef, useState } from 'react'
import { useFrameRef } from '../../hooks/useMovementClock'
import { formatUtc, formatLocal, formatDate, formatOffset, formatElapsed, formatMs, timeZoneName } from '../../lib/format'
import { Lamp } from '../ui/Instrument'
import './telemetry.css'

/**
 * The build identifier.
 *
 * Vite exposes the commit SHA to production builds through this define. It is
 * `undefined` locally, in which case the strip says DEV — which is the truth,
 * rather than a plausible-looking string standing in for one.
 */
const BUILD: string | undefined = import.meta.env.VITE_GIT_COMMIT as string | undefined

type Transport = { effectiveType?: string; downlink?: number } | null

/** Frames per frame-interval readout. 15 frames at 60 Hz is 4 Hz. */
const FRAME_READOUT_EVERY = 15

function readTransport(): Transport {
  const c = (navigator as Navigator & { connection?: Transport }).connection
  return c ?? null
}

type CellProps = {
  k: string
  children: React.ReactNode
  sub?: string | undefined
  accent?: boolean
  dim?: boolean
}

/**
 * A telemetry cell. The value is a live node written by the frame loop, so
 * `children` is usually a ref-bearing element rather than text.
 */
function Cell({ k, children, sub, accent, dim }: CellProps) {
  return (
    <div className="tcell">
      <div className="tcell__key">
        <span className="lbl">{k}</span>
      </div>
      <span
        className={`tcell__val${accent ? ' tcell__val--accent' : ''}${dim ? ' tcell__val--dim' : ''}`}
      >
        {children}
      </span>
      {sub ? <span className="tcell__sub">{sub}</span> : null}
    </div>
  )
}

export function Telemetry() {
  const [offset, setOffset] = useState<string | null>(null)
  const [zone, setZone] = useState<string | undefined>(undefined)
  const [transport, setTransport] = useState<Transport>(null)

  const frameAccum = useRef(0)
  const frameWindow = useRef(0)

  // These do not change during a session, so they are read once on mount
  // rather than being recomputed every frame.
  useEffect(() => {
    setOffset(formatOffset(new Date()))
    setZone(timeZoneName())
    setTransport(readTransport())
  }, [])

  const utcRef = useRef<HTMLSpanElement>(null)
  const localRef = useRef<HTMLSpanElement>(null)
  const dateRef = useRef<HTMLSpanElement>(null)
  const sessionRef = useRef<HTMLSpanElement>(null)
  const frameRef = useRef<HTMLSpanElement>(null)
  const mechRef = useRef<HTMLSpanElement>(null)

  useFrameRef((f) => {
    write(utcRef.current, formatUtc(f.now))
    write(localRef.current, formatLocal(f.now))
    write(dateRef.current, formatDate(f.now))
    write(sessionRef.current, formatElapsed(f.sessionMs))
    write(mechRef.current, f.engaged ? 'WORKING' : 'AT REST')

    /* The frame interval is a real measurement, but a figure changing sixty
       times a second cannot be read. It is sampled and reported at 4 Hz, which
       is the rate the caption states. Reporting the true instantaneous value
       every frame would be more literal and less useful. */
    frameAccum.current += f.frameDelta
    frameWindow.current += 1
    if (frameWindow.current >= FRAME_READOUT_EVERY) {
      const mean = frameAccum.current / frameWindow.current
      write(frameRef.current, formatMs(mean))
      frameAccum.current = 0
      frameWindow.current = 0
    }
  })

  return (
    <div className="telemetry" role="group" aria-label="Live telemetry">
      <Cell k="UTC" sub="SYSTEM CLOCK" accent>
        <span ref={utcRef}>--:--:--.---</span>
      </Cell>

      <Cell k="LOCAL" sub={offset ?? undefined}>
        <span ref={localRef}>--:--:--</span>
      </Cell>

      <Cell k="DATE" sub={zone ?? undefined}>
        <span ref={dateRef}>—</span>
      </Cell>

      <Cell k="SESSION" sub="ELAPSED" accent>
        <span ref={sessionRef}>00:00</span>
      </Cell>

      <Cell k="FRAME" sub="MS · 4HZ MEAN">
        <span ref={frameRef}>—</span>
      </Cell>

      <Cell k="MECHANISM" sub="SCROLL-DRIVEN">
        <Lamp tone="off">
          <span ref={mechRef}>AT REST</span>
        </Lamp>
      </Cell>

      <Cell k="BUILD" sub={BUILD ? 'GIT SHA' : 'LOCAL'}>
        <span className={BUILD ? undefined : 'tcell__val--dim'}>
          {BUILD ? BUILD.slice(0, 7) : 'DEV'}
        </span>
      </Cell>

      <Cell
        k="TRANSPORT"
        sub={transport?.effectiveType ? 'NETWORK' : 'NOT EXPOSED'}
        dim={!transport?.effectiveType}
      >
        {transport?.effectiveType ? transport.effectiveType.toUpperCase() : 'N/A'}
      </Cell>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Frame-loop write helper. Change-guarded: a value that has not changed costs
   no DOM mutation, which is what keeps a 60 Hz loop free.
   -------------------------------------------------------------------------- */

function write(el: HTMLSpanElement | null, next: string): void {
  if (el && el.textContent !== next) el.textContent = next
}
