import { useEffect, useRef, useState } from 'react'
import { SectionHead, KV } from '../ui/Instrument'
import { projects, type Project } from '../../data/projects'
import { recordedFieldCount, TOTAL_PROJECT_FIELDS } from '../../data/projects'
import './vault.css'

/**
 * CALIBER 03 — CHRONO VAULT
 *
 * Projects are the proof of execution, so this section gets the largest type
 * on the page after the hero and the most generous measure. The instrument
 * language is present in the frame and the index, and then gets out of the way.
 *
 * A field that is not recorded renders as NOT RECORDED. It is never filled
 * with a plausible value, and a plate with empty fields still renders in full
 * because the structure is the information.
 */
export function Caliber03() {
  const [selected, setSelected] = useState(0)
  const [shutter, setShutter] = useState(false)
  const first = useRef(true)

  const project: Project = projects[selected] ?? projects[0]

  /* Re-trigger the shutter on each selection change, except the first paint
     where animating would be noise. */
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setShutter(false)
    const id = requestAnimationFrame(() => setShutter(true))
    return () => cancelAnimationFrame(id)
  }, [selected])

  return (
    <section className="plate-section" id="caliber-03" aria-labelledby="cal-03-title">
      <div className="shell">
        <SectionHead caliber="03" title="Chrono vault" note="SELECTED WORK">
          <h2 className="sr-only" id="cal-03-title">
            Chrono vault
          </h2>
        </SectionHead>

        <div className="vault">
          {/* --- Index --- */}
          <div className="vault__index" role="tablist" aria-label="Projects" aria-orientation="vertical">
            {projects.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                className="vault__tab"
                aria-selected={i === selected}
                aria-controls="vault-plate"
                tabIndex={i === selected ? 0 : -1}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    e.preventDefault()
                    setSelected((s) => Math.min(projects.length - 1, s + 1))
                  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    e.preventDefault()
                    setSelected((s) => Math.max(0, s - 1))
                  }
                }}
              >
                <span className="vault__tab-num">{p.index}</span>
                <span className="vault__tab-title">{p.title}</span>
                {p.year ? <span className="vault__tab-year">{p.year}</span> : null}
              </button>
            ))}
          </div>

          {/* --- Plate --- */}
          <article
            className="plate-frame"
            id="vault-plate"
            role="tabpanel"
            tabIndex={0}
            data-shutter={shutter || undefined}
          >
            <header className="plate-frame__head">
              <h3 className="plate-frame__title">{project.title}</h3>
              {project.classification ? (
                <span className="plate-frame__tag">{project.classification}</span>
              ) : null}
            </header>

            <div className="plate-frame__body">
              <dl>
                <KV k="Purpose">{project.purpose}</KV>
                <KV k="Technical challenge">{project.challenge}</KV>
                <KV k="Result">{project.result}</KV>
                <KV k="Stack" mono>
                  {project.stack?.length ? project.stack.join(' · ') : null}
                </KV>
                <KV k="Year" mono>
                  {project.year ? String(project.year) : null}
                </KV>
              </dl>

              {/* Metrics appear only when supplied, and the schema requires each
                  value to arrive with the thing it measures, so a bare number
                  can never be displayed. Otherwise the field says so. */}
              {project.metrics?.length ? (
                <div className="metrics">
                  {project.metrics.map((m) => (
                    <div className="metric" key={m.label}>
                      <span className="metric__val">{m.value}</span>
                      <span className="metric__label">{m.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <KV k="Metrics">{null}</KV>
              )}

              {project.notes ? <p className="plate-frame__notes">{project.notes}</p> : null}

              {project.demo || project.source ? (
                <div className="plate-frame__links">
                  {project.demo ? (
                    <a className="btn" href={project.demo} target="_blank" rel="noreferrer noopener">
                      Live demo
                    </a>
                  ) : null}
                  {project.source ? (
                    <a
                      className="btn"
                      href={project.source}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Source
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        </div>

        {/* --- Coverage. A statement about this vault, not a boast about the
            person who made it. --- */}
        <p className="vault__coverage">
          <span className="lbl">Recorded fields</span>{' '}
          <span className="mono">
            {recordedFieldCount()} / {TOTAL_PROJECT_FIELDS}
          </span>
          <span className="vault__coverage-note">
            — unrecorded fields are left visible rather than filled with estimates.
          </span>
        </p>
      </div>
    </section>
  )
}
