import { site } from '../../config/site'
import './footer.css'

/**
 * The document foot. Carries the identity, the references, and a statement of
 * what was actually built — which is a more useful thing for a reader than a
 * colophon full of adjectives would be.
 */
export function Footer() {
  const references = [
    { label: 'GitHub', href: site.links.github },
    { label: 'Email', href: `mailto:${site.links.email.replace(/[[\]]/g, '')}` },
    ...(site.links.resume ? [{ label: 'Résumé', href: site.links.resume }] : []),
    ...(site.links.linkedin ? [{ label: 'LinkedIn', href: site.links.linkedin }] : []),
  ]

  return (
    <footer className="foot">
      <div className="shell">
        <div className="foot__grid">
          <div className="foot__col">
            <span className="lbl">Colophon</span>
            <p className="foot__note">
              One requestAnimationFrame loop for the whole page. No WebGL, no canvas, no animation
              library. The dial and the gear train are static SVG whose geometry is generated once
              at mount; only their transforms are written per frame, and only when a value has
              actually changed.
            </p>
          </div>

          <div className="foot__col">
            <span className="lbl">References</span>
            <ul className="foot__links">
              {references.map((r) => (
                <li key={r.label}>
                  <a className="foot__link" href={r.href} target="_blank" rel="noreferrer noopener">
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="foot__col">
            <span className="lbl">Coliber</span>
            <p className="foot__meta">
              {site.name}
              <br />
              {site.role}
              <br />
              {site.location}
            </p>
          </div>
        </div>

        <div className="foot__base">
          <span className="lbl">Caliber 00 — Precision over promises</span>
          <span className="lbl">{new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  )
}
