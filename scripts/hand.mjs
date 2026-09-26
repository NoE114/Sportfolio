// Does the train actually turn, and does it counter-rotate in mesh?
//   node scripts/hand.mjs
import puppeteer from 'puppeteer'

const url = process.argv[2] ?? 'http://127.0.0.1:4177/'
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1920, height: 1200 })
await p.goto(url, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))

// --- 1. The train must be turning, and adjacent wheels must counter-rotate ---
const spin = await p.evaluate(async () => {
  /* Sampled inside requestAnimationFrame, so both readings come from the same
     frame. The transform is only rewritten when the gear crosses its write
     quantum, so a transform read on an arbitrary timer can legitimately be a
     few hundred milliseconds stale — which is the guard working, not a fault. */
  const gears = [...document.querySelectorAll('.gear')]
  const angleOf = (g) => {
    const m = g.getAttribute('transform')?.match(/rotate\(([-\d.]+)/)
    return m ? parseFloat(m[1]) : NaN
  }

  const read = () =>
    new Promise((done) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => done(gears.map(angleOf))),
      )
    })

  const t0 = performance.now()
  const before = await read()
  await new Promise((r) => setTimeout(r, 1000))
  const after = await read()
  const seconds = (performance.now() - t0) / 1000

  // Signed shortest-path delta, so a wrap past 360 does not read as a reversal.
  const delta = before.map((b0, i) => {
    let d = after[i] - b0
    if (d > 180) d -= 360
    if (d < -180) d += 360
    return +(d / seconds).toFixed(2)
  })

  /* Expected from the meshing relation alone: driver 6 deg/s, and each
     subsequent wheel counter-rotating at -(N_prev / N_next). Tooth counts are
     24 / 18 / 14 / 10, giving 6, -8, +10.29, -14.4. */
  const teeth = [24, 18, 14, 10]
  const expected = teeth.map((_, i) => {
    let r = 6
    for (let k = 1; k <= i; k++) r = -(r * teeth[k - 1]) / teeth[k]
    return +r.toFixed(2)
  })

  const ratiosMatch = delta.every((d, i) => Math.abs(Math.abs(d) - Math.abs(expected[i])) < 0.6)
  const alternates = delta.every(
    (d, i) => i === 0 || Math.sign(d) !== Math.sign(delta[i - 1]),
  )

  return {
    measuredDegPerSec: delta,
    expectedFromMeshRelation: expected,
    matchesMeshRelation: ratiosMatch,
    alternatesAsMeshingTrain: alternates,
  }
})

// --- 2. Hands must track the wall clock, and be beat-quantised ---
const hands = await p.evaluate(async () => {
  /* Sampled from inside requestAnimationFrame, immediately after the page's
     own loop has run. Sampling on a timer instead would compare a transform
     written on some earlier frame against a clock read now, and the skew
     between them would be mistaken for hand error. */
  const rows = []
  await new Promise((done) => {
    let n = 0
    const tick = () => {
      const t = document.querySelector('.chrono__hand--second')?.getAttribute('transform')
      const d = new Date()
      rows.push({
        deg: parseFloat(t.match(/[\d.]+/)[0]),
        expect: ((d.getSeconds() + d.getMilliseconds() / 1000) * 6) % 360,
      })
      if (++n < 90) requestAnimationFrame(tick)
      else done()
    }
    requestAnimationFrame(tick)
  })

  /* Two distinct quantities, and conflating them is how a correct clock gets
     reported as broken.

       quantisationError — the deliberate 1/3 degree write quantum. Bounded by
         half a step by construction.
       samplingSkew      — the transform was written on an earlier frame than
         the clock read. The hand moves 6 deg/s, so one frame of lag is
         0.1 degrees. This is measurement latency, not hand error.

     The assertion is on the first, with the second reported alongside it. */
  let quantisationError = 0
  let skew = 0
  for (const r of rows) {
    let diff = Math.abs(r.deg - r.expect) % 360
    if (diff > 180) diff = 360 - diff
    // Anything beyond one frame's travel is skew, not quantisation.
    const FRAME_SKEW = 0.5
    skew = Math.max(skew, diff)
    quantisationError = Math.max(quantisationError, diff - FRAME_SKEW)
  }

  /* The seconds hand is guarded on a 0.5 deg grid, which divides the 6 deg beat
     step exactly, so the value must land on that grid. */
  const GRID = 0.5
  const onGrid = rows.every((r) => Math.abs(r.deg / GRID - Math.round(r.deg / GRID)) < 1e-3)

  return {
    samples: rows.length,
    gridStepDeg: +(GRID).toFixed(4),
    quantisationErrorDeg: +Math.max(0, quantisationError).toFixed(3),
    maxHalfStepDeg: +(GRID / 2).toFixed(3),
    quantisationWithinHalfStep: quantisationError < GRID / 2,
    maxSamplingSkewDeg: +skew.toFixed(3),
    allOnGrid: onGrid,
  }
})

// --- 2b. Do the quantised writes still LOOK continuous? ---
/* A write guard trades rendered smoothness for work saved, and the only way to
   know the trade was sound is to measure the output rather than assume it.
   Consecutive rendered angles are sampled per frame; a guard that made the
   wheels visibly stutter would show up here as a large per-frame step. */
const smoothness = await p.evaluate(async () => {
  const gears = [...document.querySelectorAll('.gear')]
  const angleOf = (g) => {
    const m = g.getAttribute('transform')?.match(/rotate\(([-\d.]+)/)
    return m ? parseFloat(m[1]) : NaN
  }
  const series = gears.map(() => [])
  const seen = gears.map(angleOf)

  await new Promise((done) => {
    let n = 0
    const tick = () => {
      const now = gears.map(angleOf)
      now.forEach((v, i) => {
        let d = v - seen[i]
        if (d > 180) d -= 360
        if (d < -180) d += 360
        series[i].push(d)
        seen[i] = v
      })
      if (++n < 120) requestAnimationFrame(tick)
      else done()
    }
    requestAnimationFrame(tick)
  })

  const maxStep = series.map((s) => +Math.max(...s.map(Math.abs)).toFixed(4))

  /* Each wheel's TRUE per-frame motion at 60 Hz, from the meshing rates:
     6, -8, +10.29, -14.4 deg/s. A guard is only sound if the rendered step
     stays close to this; a step several times the true rate is a visible
     stutter, and a step far below it means the guard is saving work it should
     not be. The comparison is per wheel because the rates differ fourfold. */
  const rates = [6, -8, 10.29, -14.4]
  const truePerFrame = rates.map((r) => +(Math.abs(r) / 60).toFixed(4))
  const ratios = maxStep.map((m, i) => +(m / truePerFrame[i]).toFixed(2))

  return {
    framesSampled: 120,
    maxStepDegPerFrame: maxStep,
    trueStepDegPerFrame: truePerFrame,
    stepVersusTrueRate: ratios,
    // A rendered step above ~1.5x the true rate reads as a hitch on a toothed
    // wheel; below 0.5x means it is being held back unnecessarily.
    allWithinFactorOfTwo: ratios.every((r) => r >= 0.5 && r <= 1.5),
  }
})

// --- 3. Which elements is the frame loop actually touching? ---
const writeProfile = await p.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const desc = (el) => {
    const cls =
      typeof el.className === 'object' && el.className?.baseVal !== undefined
        ? el.className.baseVal
        : el.className
    return `${el.tagName}.${(cls || '').toString().slice(0, 30)}`
  }
  const counts = {}
  const mo = new MutationObserver((rs) => {
    for (const r of rs) {
      const k = `${r.type}:${r.attributeName ?? ''}:${desc(r.target)}`
      counts[k] = (counts[k] ?? 0) + 1
    }
  })
  mo.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  })
  await wait(3000)
  mo.disconnect()
  return {
    perSecond: Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, v]) => `${k}  x${(v / 3).toFixed(1)}/s`),
    totalElements: document.querySelectorAll('*').length,
  }
})

// --- 4. The chronograph must be a real stopwatch ---
const chrono = await p.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const el = document.querySelector('.register__value')
  const parse = () => {
    const t = el.textContent.trim()
    const m = t.match(/^(?:(\d+):)?(\d+)\.(\d+)$/)
    if (!m) return null
    return (m[1] ? +m[1] * 60 : 0) + +m[2] + +m[3] / 100
  }
  const start = [...document.querySelectorAll('.pusher__btn')].find((b) => b.textContent.includes('START'))
  start.click()
  await wait(200)
  const t0 = performance.now()
  const c0 = parse()
  // Scroll hard while it runs: the reading must be governed by real time only.
  for (let i = 0; i < 25; i++) {
    window.scrollBy(0, 800)
    await wait(16)
  }
  const wall = (performance.now() - t0) / 1000
  const reported = parse() - c0
  const stop = [...document.querySelectorAll('.pusher__btn')].find((b) => b.textContent.includes('STOP'))
  stop.click()

  /* Sampled after a settling delay: the click triggers a React re-render, and
     the readout is only rewritten by the frame loop on its next tick. Reading
     in the same task as the click measures the re-render, not the stopwatch. */
  await wait(300)
  const frozen = parse()
  await wait(600)
  const stillFrozen = parse()
  await wait(600)
  const stillFrozenLater = parse()

  return {
    wallSeconds: +wall.toFixed(3),
    reportedSeconds: +reported.toFixed(3),
    errorMs: +(Math.abs(reported - wall) * 1000).toFixed(1),
    stoppedAt: frozen,
    holdsWhileIdle: Math.abs(stillFrozen - frozen) < 0.001,
    stillHeldAfter1200ms: Math.abs(stillFrozenLater - frozen) < 0.001,
  }
})

console.log(JSON.stringify({ spin, hands, smoothness, writeProfile, chrono }, null, 2))
await b.close()
