import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SectionHead } from '../ui/Instrument'
import { useFrameRef } from '../../hooks/useMovementClock'
import { modules, relations } from '../../data/calibration'
import {
  computeLayout,
  computeLeaders,
  gearGeometry,
  techTop,
  terminator,
  type Orientation,
  type TechNode,
} from './layout'
import './matrix.css'

/** Component plate dimensions, in diagram units. */
const PLATE_W = 62
const PLATE_H = 15

/** Rotation of the train. Scaled by scroll activity, never by time. */
const DRIVE_BOOST = 2.6

function useOrientation(): Orientation {
  const query = '(min-width: 900px)'
  const [orientation, setOrientation] = useState<Orientation>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
        ? 'horizontal'
        : 'vertical'
    : 'horizontal',
  )

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(query)
    const onChange = () => setOrientation(mq.matches ? 'horizontal' : 'vertical')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return orientation
}

/**
 * CALIBER 02 — GEAR MATRIX
 *
 * The stack is drawn as a gear train, and the train is real in one specific
 * sense: two meshing gears turn in opposite directions at rates inversely
 * proportional to their tooth counts. The tooth counts themselves, and the
 * relations between technologies, describe the layout of this diagram — which
 * is why the plate is stamped as a schematic rather than presented as a
 * measurement.
 */
export function Caliber02() {
  const orientation = useOrientation()
  const layout = useMemo(() => computeLayout(orientation), [orientation])
  const geometry = useMemo(() => layout.gears.map(gearGeometry), [layout])

  const [active, setActive] = useState<string | null>(null)
  const gearRefs = useRef<Array<SVGGElement | null>>([])

  const leaders = useMemo(() => computeLeaders(layout, active), [layout, active])

  const relatedIds = useMemo(() => {
    if (!active) return new Set<string>()
    return new Set(
      relations.filter((r) => r.from === active || r.to === active).map((r) =>
        r.from === active ? r.to : r.from,
      ),
    )
  }, [active])

  /* --- Train rotation.
     The base rate is the running state of a running movement. Scroll activity
     adds intensity on top of it. Neither figure touches a measurement — this
     callback only writes transform attributes on the gear groups.

     The rotation MUST name the gear's own centre. `rotate(deg)` alone pivots
     about the SVG origin, which throws each wheel off across the canvas. */
  const phaseRef = useRef<number[]>(layout.gears.map(() => 0))

  useFrameRef((f) => {
    const dt = f.frameDelta
    if (dt <= 0 || dt > 100) return
    const intensity = 1 + f.drive * DRIVE_BOOST

    for (let i = 0; i < layout.gears.length; i++) {
      const el = gearRefs.current[i]
      if (!el) continue
      const g = layout.gears[i]
      phaseRef.current[i] =
        (phaseRef.current[i] + ((g.rate * dt) / 1000) * intensity) % 360

      /* Change-guard. Below the quantum the wheel has not visibly turned, so
         writing the transform would cost a mutation record and a style
         recalculation for movement that cannot be seen. */
      /* Rounded, not merely compared: two angles within the quantum can still
         differ in the third decimal, which would make the change guard miss and
         emit a longer string for a movement nobody can see. Rounding first
         makes equal angles produce equal strings. */
      /* Written every frame, deliberately.

         A write guard is only worth having when the element is slow enough for
         the guard to be a multiple of several frames' travel. These wheels are
         not: at 6 to 14 deg/s each one moves a visible fraction of a degree per
         frame, so any quantum coarse enough to save a meaningful number of
         writes also produces a visible step. Measured, not assumed — see the
         smoothness assertion in scripts/hand.mjs, which compares the rendered
         per-frame step against each wheel's own rate.

         Four attribute writes a frame is not a cost worth optimising against;
         0.48-degree steps on a 24-tooth wheel are a defect. The guards that DO
         pay are on the watch hands, which are slow or beat-quantised, and those
         cut from 60 writes a second to 12. */
      el.setAttribute(
        'transform',
        `rotate(${phaseRef.current[i].toFixed(3)} ${g.cx.toFixed(2)} ${g.cy.toFixed(2)})`,
      )
    }
  })

  const onActivate = useCallback((id: string | null) => setActive(id), [])

  const techById = useMemo(() => new Map(layout.techs.map((t) => [t.id, t])), [layout])
  const activeTech = active ? techById.get(active) : null

  return (
    <section className="plate-section" id="caliber-02" aria-labelledby="cal-02-title">
      <div className="shell">
        <SectionHead caliber="02" title="Gear matrix" note="SYSTEM TOPOLOGY">
          <h2 className="sr-only" id="cal-02-title">
            Gear matrix
          </h2>
        </SectionHead>

        <div className="matrix">
          <div className="matrix__body">
            {/* The honesty stamp sits above the plate rather than inside it, so
                it can never collide with a gear or a component at any width. */}
            <div className="matrix__stamp">Schematic — not to scale</div>

            <div className="matrix__frame">
              <svg
                className="matrix__svg"
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                role="img"
                aria-label={`Gear train diagram with four modules: ${modules
                  .map((m) => `${m.label} (${m.techs.map((t) => t.label).join(', ')})`)
                  .join('; ')}. Adjacent modules are geared to each other. The full relationships are listed alongside the diagram.`}
              >
                {/* --- Gears ---
                    Each gear is drawn with its teeth pointing outward from its
                    own centre, and the group is then rotated about that centre,
                    so the teeth visibly mesh with the neighbouring wheel. */}
                {layout.gears.map((g, i) => (
                  <g
                    key={g.id}
                    ref={(el) => {
                      gearRefs.current[i] = el
                    }}
                    className="gear"
                  >
                    <path className="gear__outline" d={geometry[i].outline} />
                    <path className="gear__body" d={geometry[i].body} />
                    <circle
                      className="gear__hub"
                      cx={g.cx}
                      cy={g.cy}
                      r={Math.max(2.5, g.tipRadius * 0.07)}
                    />
                  </g>
                ))}

                {/* --- Leader lines, drawn under the components --- */}
                {leaders.map((l, i) => (
                  <g key={`lead${i}`}>
                    <path className="leader" d={l.d} />
                    <path className="leader__term" d={terminator(l.to, orientation)} />
                    <text className="leader__text" x={l.lx} y={l.ly}>
                      {l.label}
                    </text>
                  </g>
                ))}

                {/* --- Module labels --- */}
                {layout.gears.map((g) =>
                  orientation === 'horizontal' ? (
                    <g key={`lbl${g.id}`}>
                      <text className="gear__label" x={g.cx} y={layout.labelY} textAnchor="middle">
                        {g.label}
                      </text>
                      <text
                        className="gear__teeth"
                        x={g.cx}
                        y={layout.labelY + 11}
                        textAnchor="middle"
                      >
                        {`${g.teeth}T`}
                      </text>
                    </g>
                  ) : (
                    /* Vertical: a single shared column clear of the widest
                       wheel, because the next wheel sits directly below and
                       leaves no room above. */
                    /* Vertical: the name sits above its own stack, anchored to
                       the column. The stack begins below the TEETH line, so
                       the name can never be overwritten by a component. */
                    <g key={`lbl${g.id}`}>
                      <text
                        className="gear__label"
                        x={layout.columnX}
                        y={techTop(g)}
                        textAnchor="start"
                      >
                        {g.label}
                      </text>
                      <text
                        className="gear__teeth"
                        x={layout.columnX}
                        y={techTop(g) + 10}
                        textAnchor="start"
                      >
                        {`${g.teeth}T`}
                      </text>
                    </g>
                  ),
                )}

                {/* --- Components ---
                    Each is a focusable group, so the relations are reachable
                    by keyboard and not only by pointer. */}
                {layout.techs.map((t) => (
                  <TechMarker
                    key={t.id}
                    node={t}
                    isActive={active === t.id}
                    isRelated={relatedIds.has(t.id)}
                    onEnter={() => onActivate(t.id)}
                    onLeave={() => onActivate(null)}
                  />
                ))}
              </svg>
            </div>
          </div>

          {/* --- Side panel: the relations, as text.
              This is not a fallback. The diagram carries the relationships
              visually; this panel carries them in a form that can be read,
              scanned and spoken. --- */}
          <aside className="matrix__panel">
            {/* The two spans are visually separated by a flex gap, but gap is
                not exposed to assistive technology, so the composed label is
                supplied explicitly. Without it the readout is announced as
                "DOCKERMeshed with LINUX". aria-label is omitted on the resting
                state so the visible hint is always announced verbatim. */}
            <div
              className="matrix__readout"
              aria-live="polite"
              aria-label={
                activeTech
                  ? `${activeTech.label}. ${
                      relatedIds.size === 0
                        ? 'No cross-relations recorded.'
                        : `Meshed with ${[...relatedIds]
                            .map((id) => techById.get(id)?.label ?? id)
                            .join(', ')}.`
                    }`
                  : undefined
              }
            >
              {/* Hidden from assistive technology only while an aria-label
                  carries the composed text. In the resting state there is no
                  label, so the visible hint must remain readable. */}
              {activeTech ? (
                <>
                  <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
                    {activeTech.label}
                  </span>
                  <span className="matrix__readout-hint" aria-hidden="true">
                    {relatedIds.size === 0
                      ? 'No cross-relations recorded'
                      : `Meshed with ${[...relatedIds]
                          .map((id) => techById.get(id)?.label ?? id)
                          .join(', ')}`}
                  </span>
                </>
              ) : (
                <span className="matrix__readout-hint">
                  Hover or focus a component to trace its relations
                </span>
              )}
            </div>

            <div className="matrix__legend">
              <span className="matrix__legend-item">
                <span className="matrix__swatch" style={{ color: 'var(--accent-brass)' }} />
                Gear train — geared, not scaled
              </span>
              <span className="matrix__legend-item">
                <span className="matrix__swatch" style={{ color: 'var(--accent)' }} />
                Active relation
              </span>
              <span className="matrix__legend-item">
                <span className="matrix__swatch" style={{ color: 'var(--metal-dim)' }} />
                Component
              </span>
            </div>

            <dl className="matrix__relations">
              {modules.map((m) => (
                <div key={m.id} className="kv">
                  <dt className="kv__key">{m.label}</dt>
                  <dd className="kv__val kv__val--mono">
                    {m.techs.map((t) => t.label).join(' · ')}
                  </dd>
                </div>
              ))}
            </dl>

            <details className="matrix__details">
              <summary className="lbl">Relations, in full</summary>
              <dl className="matrix__relist">
                {relations.map((r) => (
                  <div key={`${r.from}-${r.to}`} className="matrix__rel">
                    <span className="matrix__rel-from">{labelOf(r.from)}</span>
                    <span className="matrix__rel-label">{r.label}</span>
                    <span className="matrix__rel-to">{labelOf(r.to)}</span>
                  </div>
                ))}
              </dl>
            </details>
          </aside>
        </div>
      </div>
    </section>
  )
}

/** Resolve a technology id to its label. */
function labelOf(id: string): string {
  return modules.flatMap((m) => m.techs).find((t) => t.id === id)?.label ?? id
}

function TechMarker({
  node,
  isActive,
  isRelated,
  onEnter,
  onLeave,
}: {
  node: TechNode
  isActive: boolean
  isRelated: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  const centred = node.anchor === 'center'
  const x = centred ? node.x - PLATE_W / 2 : node.x
  const y = node.y - PLATE_H / 2

  return (
    <g
      className="comp"
      data-active={isActive || undefined}
      data-related={isRelated || undefined}
      tabIndex={0}
      role="button"
      aria-label={`${node.label}. Show related systems.`}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <rect
        className="comp__focus"
        x={x - 2}
        y={y - 2}
        width={PLATE_W + 4}
        height={PLATE_H + 4}
        rx="1"
      />
      <rect className="comp__plate" x={x} y={y} width={PLATE_W} height={PLATE_H} rx="1" />
      <rect className="comp__tab" x={x} y={y} width="2.5" height={PLATE_H} />
      <text className="comp__text" x={x + 9} y={y + PLATE_H / 2}>
        {node.label}
      </text>
    </g>
  )
}
