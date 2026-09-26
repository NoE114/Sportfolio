import { useCallback, useRef, useState } from 'react'
import { SectionHead, Lamp } from '../ui/Instrument'
import { play } from '../../lib/audio'
import { site } from '../../config/site'
import './transmission.css'

/* --------------------------------------------------------------------------
   Netlify Forms
   --------------------------------------------------------------------------
   The form posts URL-encoded to the site root. Netlify does not accept JSON
   on form submissions, which is the single most common reason a Netlify form
   returns 400 from a React app.

   Registration happens at BUILD time, from the hidden static declaration in
   index.html. If that block is removed the form will 404 no matter what this
   component does.
   ------------------------------------------------------------------------ */

const FORM_NAME = 'frequency-transmitter'

type Phase = 'ready' | 'transmitting' | 'sent' | 'failed'
type StepState = 'pending' | 'active' | 'done' | 'failed'

const STEPS: { key: Phase; label: string }[] = [
  { key: 'ready', label: 'Ready' },
  { key: 'transmitting', label: 'Transmitting' },
  { key: 'sent', label: 'Packet sent' },
  { key: 'sent', label: 'Confirmed' },
]

type Errors = Partial<Record<'name' | 'email' | 'message', string>>

/**
 * CALIBER 04 — FREQUENCY TRANSMITTER
 *
 * The state machine is bound to the real request lifecycle. TRANSMITTING is
 * entered when the fetch starts, PACKET SENT when the server accepts, and
 * CONFIRMED on the response. A rejection lands on FAILED and says what went
 * wrong. There is no path that reaches CONFIRMED without the server having
 * accepted the submission.
 */
export function Caliber04() {
  const [phase, setPhase] = useState<Phase>('ready')
  const [errors, setErrors] = useState<Errors>({})
  const [note, setNote] = useState<string | null>(null)
  const [receivedAt, setReceivedAt] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const validate = useCallback((data: FormData): Errors => {
    const e: Errors = {}
    const name = String(data.get('name') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const message = String(data.get('message') ?? '').trim()

    if (!name) e.name = 'Required'
    // Deliberately loose: enough to catch a typo, not a judgment about whether
    // an address is real.
    if (!email) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = 'Check format'
    if (!message) e.message = 'Required'

    return e
  }, [])

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = formRef.current
      if (!form || phase === 'transmitting') return

      const data = new FormData(form)
      const found = validate(data)
      setErrors(found)
      if (Object.keys(found).length > 0) {
        setNote('Fix the marked fields and transmit again.')
        play('clack')
        return
      }

      setPhase('transmitting')
      setNote(null)
      play('tick')

      try {
        // URLSearchParams over the FormData gives exactly the encoding Netlify
        // requires, and carries the honeypot field with it. Built explicitly
        // rather than via the FormData constructor overload.
        const params = new URLSearchParams()
        for (const [key, value] of data.entries()) params.append(key, String(value))

        const res = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        })

        if (!res.ok) throw new Error(`Server responded ${res.status}`)

        setPhase('sent')
        setReceivedAt(new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z')
        setNote('Received. Stored against this form on Netlify.')
        play('clack')
        form.reset()
      } catch (err) {
        setPhase('failed')
        setNote(
          err instanceof Error
            ? `Transmission failed: ${err.message}. Nothing was sent.`
            : 'Transmission failed. Nothing was sent.',
        )
        play('clack')
      }
    },
    [phase, validate],
  )

  const stepStates = stepStatesFor(phase)

  return (
    <section className="plate-section" id="caliber-04" aria-labelledby="cal-04-title">
      <div className="shell">
        <SectionHead caliber="04" title="Frequency transmitter" note="DIRECT CHANNEL">
          <h2 className="sr-only" id="cal-04-title">
            Frequency transmitter
          </h2>
        </SectionHead>

        <div className="tx">
          {/* --- The console --- */}
          <form
            className="tx__form"
            ref={formRef}
            name={FORM_NAME}
            method="POST"
            data-netlify="true"
            onSubmit={onSubmit}
            noValidate
          >
            {/* Netlify requires this to match the form's registered name. */}
            <input type="hidden" name="form-name" value={FORM_NAME} />

            {/* Honeypot. Must be present and must be submitted; Netlify
                rejects the submission if a bot fills it in. */}
            <p className="hp" aria-hidden="true">
              <label>
                Do not fill this out: <input name="bot-field" tabIndex={-1} autoComplete="off" />
              </label>
            </p>

            <div className="field">
              <div className="field__label">
                <label className="lbl" htmlFor="tx-name">
                  Operator
                </label>
                <span className="field__req">Required</span>
              </div>
              <input
                className="field__input"
                id="tx-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'tx-name-err' : undefined}
                disabled={phase === 'transmitting'}
              />
              {errors.name ? (
                <span className="field__error" id="tx-name-err">
                  {errors.name}
                </span>
              ) : null}
            </div>

            <div className="field">
              <div className="field__label">
                <label className="lbl" htmlFor="tx-email">
                  Return channel
                </label>
                <span className="field__req">Required</span>
              </div>
              <input
                className="field__input"
                id="tx-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={errors.email ? 'true' : undefined}
                aria-describedby={errors.email ? 'tx-email-err' : undefined}
                disabled={phase === 'transmitting'}
              />
              {errors.email ? (
                <span className="field__error" id="tx-email-err">
                  {errors.email}
                </span>
              ) : null}
            </div>

            <div className="field">
              <div className="field__label">
                <label className="lbl" htmlFor="tx-message">
                  Transmission
                </label>
                <span className="field__req">Required</span>
              </div>
              <textarea
                className="field__input"
                id="tx-message"
                name="message"
                placeholder="What are you working on?"
                aria-invalid={errors.message ? 'true' : undefined}
                aria-describedby={errors.message ? 'tx-message-err' : undefined}
                disabled={phase === 'transmitting'}
              />
              {errors.message ? (
                <span className="field__error" id="tx-message-err">
                  {errors.message}
                </span>
              ) : null}
            </div>

            <div className="tx__actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={phase === 'transmitting'}
              >
                {phase === 'transmitting' ? 'Transmitting…' : 'Transmit'}
              </button>

              <Lamp
                tone={
                  phase === 'sent'
                    ? 'ok'
                    : phase === 'transmitting'
                      ? 'active'
                      : phase === 'failed'
                        ? 'fail'
                        : 'off'
                }
              >
                {phase === 'ready'
                  ? 'Ready'
                  : phase === 'transmitting'
                    ? 'Transmitting'
                    : phase === 'sent'
                      ? 'Packet sent'
                      : 'Failed'}
              </Lamp>
            </div>
          </form>

          {/* --- The status panel --- */}
          <div className="tx__status">
            <div className="tx__status-head">
              <span className="lbl">Transmission log</span>
              <span className="lbl">{FORM_NAME}</span>
            </div>

            <ol className="tx__steps">
              {STEPS.map((s, i) => {
                const state = stepStates[i]
                return (
                  <li className="tx__step" key={s.label} data-state={state}>
                    <span className="tx__step-mark" aria-hidden="true">
                      {state === 'done' ? '■' : state === 'failed' ? '×' : '□'}
                    </span>
                    <span>{s.label}</span>
                    <span className="tx__step-note">
                      {state === 'done' && receivedAt ? receivedAt.slice(11) : state}
                    </span>
                  </li>
                )
              })}
            </ol>

            <div className="tx__meta">
              <div className="tx__meta-cell">
                <span className="lbl">Channel</span>
                <span className="tx__meta-val">NETLIFY FORMS</span>
              </div>
              <div className="tx__meta-cell">
                <span className="lbl">Encoding</span>
                <span className="tx__meta-val">URL-ENCODED</span>
              </div>
              <div className="tx__meta-cell">
                <span className="lbl">Spam</span>
                <span className="tx__meta-val">HOUSEPOT + FILTER</span>
              </div>
            </div>

            {/* Announced politely: the state change is the point of the
                component, and a screen reader user gets it without focus
                moving. */}
            <p className="tx__fallback" role="status" aria-live="polite">
              {note ??
                'Submissions are stored by Netlify Forms and can be emailed to an inbox from the site dashboard.'}
            </p>

            {/* A direct channel that does not depend on the form working at
                all. */}
            <a className="tx__direct" href={mailtoHref()}>
              {site.links.email}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * A mailto: built from the configured address, with the placeholder brackets
 * stripped so a half-filled config does not produce a broken link.
 */
function mailtoHref(): string {
  const address = site.links.email.replace(/[[\]]/g, '')
  return address.startsWith('mailto:') ? address : `mailto:${address}`
}

/** Map the current phase onto the four display steps. */
function stepStatesFor(phase: Phase): StepState[] {
  switch (phase) {
    case 'ready':
      return ['active', 'pending', 'pending', 'pending']
    case 'transmitting':
      return ['done', 'active', 'pending', 'pending']
    case 'sent':
      return ['done', 'done', 'done', 'done']
    case 'failed':
      return ['done', 'failed', 'pending', 'pending']
  }
}
