import { Chronometer } from '../chronometer/Chronometer'
import { Telemetry } from '../telemetry/Telemetry'
import { hero, site } from '../../config/site'
import './hero.css'

/**
 * CALIBER 00 — SYNCHRONIZED HERO
 *
 * Composition note: the instrument occupies the smaller share of the two
 * columns. The brief asks for a chronometer that is immediately legible, and
 * that is satisfied by the dial itself — the right-hand column. What must not
 * happen is the instrument crowding out the name, the statement, or the calls
 * to action, so the identity column is given the larger fraction and the
 * controls sit below the fold of the copy rather than behind the dial.
 */
export function Caliber00() {
  return (
    <section className="hero" id="caliber-00" aria-labelledby="hero-title">
      <div className="shell">
        {/* Three regions rather than two, so the mobile order can put the
            instrument between the thesis and the supporting copy. Identity
            leads, TIME is immediately below it, and neither buries the other. */}
        <div className="hero__grid">
          <div className="hero__lead">
            <div className="hero__eyebrow">
              <span className="hero__name">{site.name}</span>
              <span className="lbl" style={{ color: 'var(--accent)' }}>
                {hero.eyebrow}
              </span>
            </div>

            <h1 className="hero__title" id="hero-title">
              {hero.headline[0]}
              <br />
              <em>{hero.headline[1]}</em>
            </h1>
          </div>

          <div className="hero__instrument">
            <div className="hero__chrono">
              <Chronometer />
            </div>
          </div>

          <div className="hero__rest">
            <p className="hero__lead-line">{site.role}</p>

            <p className="hero__statement">{site.statement}</p>

            <div className="hero__actions">
              {hero.actions.map((a) => (
                <a
                  key={a.href}
                  className={a.primary ? 'btn btn--primary' : 'btn'}
                  href={a.href}
                >
                  {a.label}
                </a>
              ))}
            </div>

            <div className="hero__cue" aria-hidden="true">
              <span className="hero__cue-track" />
              <span className="lbl">Scroll to advance</span>
            </div>
          </div>
        </div>

        <div className="hero__telemetry">
          <Telemetry />
        </div>
      </div>
    </section>
  )
}
