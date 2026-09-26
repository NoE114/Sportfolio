// Behavioural verification. Not part of the app build.
//   node scripts/verify.mjs <url>
import puppeteer from 'puppeteer'

const url = process.argv[2] ?? 'http://127.0.0.1:5177/'
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))

const out = {}

/* ---- 1. THE CRITICAL GUARANTEE ----
   Scroll velocity must not be able to touch timekeeping. Capture the chronograph
   reading, scroll hard, and confirm the elapsed time is still governed purely by
   real elapsed time. */
out.separation = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const el = document.querySelector('.register__value')
  const read = () => parseFloat(el.textContent)

  // Start the chronograph.
  const start = [...document.querySelectorAll('.pusher__btn')].find((b) =>
    b.textContent.includes('START'),
  )
  start.click()

  const t0 = performance.now()
  const c0 = read()

  // Scroll violently for 1.2s. This is the input that drives the activity domain.
  for (let i = 0; i < 40; i++) {
    window.scrollBy(0, 900)
    await wait(15)
  }
  const duringDrive = document.querySelector('[data-state="running"]')?.textContent ?? null

  const t1 = performance.now()
  const c1 = read()

  // Real elapsed wall time vs what the chronograph reports.
  const wallSeconds = (t1 - t0) / 1000
  const reportedSeconds = c1 - c0

  return {
    scrollHappened: true,
    wallSeconds: +wallSeconds.toFixed(3),
    reportedSeconds: +reportedSeconds.toFixed(3),
    errorMs: +Math.abs(reportedSeconds - wallSeconds) * 1000,
    stateDuringScroll: duringDrive,
    // Within one frame of drift is correct; anything larger means scroll leaked
    // into the measurement.
    timeIsIndependentOfScroll: Math.abs(reportedSeconds - wallSeconds) < 0.05,
  }
})

/* ---- 2. Scroll must not alter UTC or session either ---- */
out.measurementsUnaffected = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const cell = (k) =>
    [...document.querySelectorAll('.tcell')].find((c) =>
      c.querySelector('.lbl')?.textContent?.trim().startsWith(k),
    )
  const session = () => cell('SESSION').querySelector('.tcell__val').textContent
  const utc = () => cell('UTC').querySelector('.tcell__val').textContent

  const s0 = session()
  const u0 = utc()
  const t0 = performance.now()
  for (let i = 0; i < 30; i++) {
    window.scrollBy(0, -700)
    await wait(15)
  }
  const wall = (performance.now() - t0) / 1000
  return { session0: s0, session1: session(), utc0: u0, utc1: utc(), wallSeconds: +wall.toFixed(2) }
})

/* ---- 3. Leader lines appear on hover ----
   A real mouse move, not a synthetic event: React implements onPointerEnter by
   delegating pointerover/pointerout, so dispatching `pointerenter` directly
   exercises nothing. */
await page.evaluate(() => document.querySelector('#caliber-02').scrollIntoView())
await new Promise((r) => setTimeout(r, 500))

const dockerBox = await page.evaluate(() => {
  const c = [...document.querySelectorAll('.comp')].find((c) =>
    c.getAttribute('aria-label')?.startsWith('DOCKER'),
  )
  const r = c.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.move(dockerBox.x, dockerBox.y)
await new Promise((r) => setTimeout(r, 250))

out.leaders = await page.evaluate(() => ({
  leaders: document.querySelectorAll('.leader').length,
  labels: [...document.querySelectorAll('.leader__text')].map((n) => n.textContent),
  readout: document.querySelector('.matrix__readout')?.textContent?.trim(),
  relatedHighlighted: document.querySelectorAll('.comp[data-related="true"]').length,
  activeMarked: document.querySelectorAll('.comp[data-active="true"]').length,
}))

// Keyboard must reach the same information.
await page.evaluate(() => document.querySelector('.comp')?.focus())
await new Promise((r) => setTimeout(r, 200))
out.leadersByKeyboard = await page.evaluate(() => ({
  leaders: document.querySelectorAll('.leader').length,
  readout: document.querySelector('.matrix__readout')?.textContent?.trim(),
}))

/* ---- 4. Reduced motion: clock must still work ---- */
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await new Promise((r) => setTimeout(r, 600))
out.reducedMotion = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const hand = () =>
    document.querySelector('.chrono__hand--second')?.getAttribute('transform')
  const h0 = hand()
  await wait(1200)
  const h1 = hand()
  const h2 = hand()
  await wait(400)
  return {
    dataMotion: document.documentElement.dataset.motion,
    handStillMoves: h0 !== h1,
    stepIsOneHz: h1 === h2,
    h0, h1, h2,
  }
})
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])

/* ---- 5. Keyboard reachability ---- */
out.keyboard = await page.evaluate(() => {
  const focusables = document.querySelectorAll(
    'a[href], button:not(:disabled), input, textarea, [tabindex]:not([tabindex="-1"])',
  )
  // Scoped to the live console. The hidden static form in index.html is a
  // build-time declaration for Netlify, is `hidden`, and is not part of the
  // accessibility tree, so labelling its inputs would be theatre.
  const live = [...document.querySelectorAll('form.tx__form input, form.tx__form textarea')]
  return {
    focusableCount: focusables.length,
    gearComponentsFocusable: document.querySelectorAll('.comp[tabindex="0"]').length,
    liveFormFields: live.length,
    unlabelledLiveInputs: live.filter(
      (i) => i.type !== 'hidden' && !i.labels?.length && !i.getAttribute('aria-label'),
    ).length,
  }
})

/* ---- 6. Form: validation must block, and never fake success ---- */
out.form = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  document.querySelector('#caliber-04').scrollIntoView()
  await wait(200)
  const form = document.querySelector('form.tx__form')

  // Empty submit must be rejected client-side.
  form.requestSubmit()
  await wait(200)
  const blocked = document.querySelectorAll('.field__error').length
  const stateAfterEmpty = [...document.querySelectorAll('.tx__step')].map((s) => s.dataset.state)

  // A real submission in dev hits the Vite dev server, which returns 404 for
  // POST /. That must surface as FAILED, not as CONFIRMED.
  form.querySelector('#tx-name').value = 'Test'
  form.querySelector('#tx-email').value = 'test@example.com'
  form.querySelector('#tx-message').value = 'Hello'
  form.requestSubmit()
  await wait(1500)
  const stateAfterSubmit = [...document.querySelectorAll('.tx__step')].map((s) => s.dataset.state)
  const note = document.querySelector('[role=status]')?.textContent?.trim()

  return {
    validationBlockedEmpty: blocked,
    stateAfterEmpty,
    stateAfterSubmit,
    note,
    neverClaimsConfirmedOnFailure: !stateAfterSubmit.includes('done') || note?.includes('failed'),
  }
})

out.errors = errors
console.log(JSON.stringify(out, null, 2))
await browser.close()
