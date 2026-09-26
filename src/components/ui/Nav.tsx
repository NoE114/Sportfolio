import { useEffect, useState } from 'react'
import { useMovement } from '../../hooks/useMovementClock'
import { setAudioEnabled, isAudioEnabled, play } from '../../lib/audio'
import './nav.css'

const SECTIONS = [
  { id: 'caliber-00', label: '00' },
  { id: 'caliber-01', label: '01' },
  { id: 'caliber-02', label: '02' },
  { id: 'caliber-03', label: '03' },
  { id: 'caliber-04', label: '04' },
] as const

export function Nav() {
  const { motionAllowed, systemReduces, toggleMotion } = useMovement()
  const [active, setActive] = useState<string>('caliber-00')
  const [soundOn, setSoundOn] = useState(isAudioEnabled)

  /* Mark the caliber currently under the header line. IntersectionObserver
     rather than a scroll listener, so the header costs nothing per frame. */
  useEffect(() => {
    const seen = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0)
        let best = ''
        let bestRatio = 0
        for (const [id, ratio] of seen) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = id
          }
        }
        if (best) setActive(best)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  const onSound = () => {
    const next = !soundOn
    setSoundOn(next)
    setAudioEnabled(next)
    // A short confirmation that the toggle did something, played only after an
    // explicit gesture, which is also what unlocks the AudioContext.
    if (next) play('tick')
  }

  return (
    <header className="nav">
      <div className="shell nav__inner">
        <div className="nav__brand">
          <a className="nav__mark" href="#caliber-00">
            SPORTFOLIO<span>·00</span>
          </a>
        </div>

        <nav className="nav__index" aria-label="Calibers">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              className="nav__link"
              href={`#${s.id}`}
              aria-current={active === s.id ? 'true' : undefined}
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="nav__controls">
          <button
            type="button"
            className="toggle"
            onClick={toggleMotion}
            aria-pressed={!motionAllowed}
            title={
              systemReduces
                ? 'Your system requests reduced motion. This overrides it for this page.'
                : 'Reduce the motion of the mechanism on this page.'
            }
          >
            <span className="toggle__dot" aria-hidden="true" />
            <span className="toggle__text">{motionAllowed ? 'MOT' : 'RED'}</span>
            <span className="sr-only">
              {motionAllowed ? 'Motion enabled' : 'Reduced motion enabled'}
            </span>
          </button>

          <button
            type="button"
            className="toggle"
            onClick={onSound}
            aria-pressed={soundOn}
            title="Pusher feedback. Off by default."
          >
            <span className="toggle__dot" aria-hidden="true" />
            <span className="toggle__text">{soundOn ? 'SND' : 'OFF'}</span>
            <span className="sr-only">Pusher sound {soundOn ? 'on' : 'off'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
