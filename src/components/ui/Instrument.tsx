import type { ReactNode } from 'react'
import './instrument.css'

/* --------------------------------------------------------------------------
   Section header. `caliber` is the two-digit number, `note` the marginal
   annotation that appears on the right of the rule.
   -------------------------------------------------------------------------- */
export function SectionHead({
  caliber,
  title,
  note,
  children,
}: {
  caliber: string
  title: string
  note?: string
  children?: ReactNode
}) {
  return (
    <header className="shead">
      <div className="shead__top">
        <div className="shead__caliber">
          <span className="shead__num">CAL {caliber}</span>
          <h2 className="shead__title">{title}</h2>
        </div>
        {note ? <span className="shead__note">{note}</span> : null}
      </div>
      {children}
    </header>
  )
}

/* --------------------------------------------------------------------------
   Indicator lamp. `tone` maps to a state; there is no decorative 'off' glow,
   an unlit lens is simply unlit.
   -------------------------------------------------------------------------- */
export function Lamp({
  tone = 'off',
  children,
}: {
  tone?: 'off' | 'ok' | 'active' | 'warn' | 'fail'
  children: ReactNode
}) {
  return (
    <span className="lamp">
      <span
        className={`lamp__lens${tone === 'off' ? '' : ` lamp__lens--${tone}`}`}
        aria-hidden="true"
      />
      <span className="lamp__text">{children}</span>
    </span>
  )
}

/* --------------------------------------------------------------------------
   Key / value. A null value renders as an explicit NOT RECORDED state rather
   than as a blank space, so a reader can always tell the difference between
   "empty" and "not stated".
   -------------------------------------------------------------------------- */
export function KV({
  k,
  children,
  mono,
}: {
  k: string
  children: ReactNode | null | undefined
  mono?: boolean
}) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className="kv">
      <dt className="kv__key">{k}</dt>
      <dd className={empty ? 'kv__val--unrecorded' : mono ? 'kv__val kv__val--mono' : 'kv__val'}>
        {empty ? 'Not recorded' : children}
      </dd>
    </div>
  )
}

/* --------------------------------------------------------------------------
   A link styled as a technical reference rather than a call to action.
   -------------------------------------------------------------------------- */
export function RefLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="btn" href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}
