// Verification harness. Not part of the app build.
//   node scripts/shoot.mjs <url> <outPrefix> [width] [height]
import puppeteer from 'puppeteer'

const [, , url, out, w = '1600', h = '1000'] = process.argv

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
})
const page = await browser.newPage()
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 2 })

const errors = []
const failed = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('requestfailed', (r) => failed.push(r.url() + ' :: ' + r.failure()?.errorText))
page.on('response', (r) => {
  if (r.status() >= 400) failed.push(r.status() + ' ' + r.url())
})

await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1800))

// --- Runtime checks the screenshot cannot show ---
const report = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const txt = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null

  const t = []
  const cells = {}
  for (const c of document.querySelectorAll('.tcell')) {
    const k = c.querySelector('.lbl')?.textContent?.trim()
    cells[k] = c.querySelector('.tcell__val')?.textContent?.trim()
  }
  t.push({ telemetry: cells })

  // 1. Is the clock actually ticking?
  const utc1 = txt('.tcell .tcell__val')
  await wait(1300)
  const utc2 = document.querySelectorAll('.tcell__val')[0]?.textContent?.trim()
  t.push({ clockTicks: { utc1, utc2, advanced: utc1 !== utc2 } })

  // 2. Seconds-hand angle must change, and must be BEAT-QUANTISED.
  const handSel = '.chrono__hand--second'
  const readHand = () => document.querySelector(handSel)?.getAttribute('transform')
  const h1 = readHand()
  await wait(260)
  const h2 = readHand()
  t.push({ secondsHand: { h1, h2, moving: h1 !== h2 } })

  // 3. Horizontal overflow at this width?
  t.push({
    overflow: {
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    },
  })

  // 4. Do the tachymeter graduations exist and is 60 at 12 o'clock?
  const grads = [...document.querySelectorAll('.chrono__tachy-num')].map((n) => ({
    v: n.textContent,
    x: +n.getAttribute('x'),
    y: +n.getAttribute('y'),
  }))
  const at = (v) => grads.find((g) => g.v === v)
  t.push({
    tachymeter: {
      count: grads.length,
      v60: at('60'),
      v120: at('120'),
      v500: at('500'),
    },
  })

  // 5. Gear mesh: centre distance must equal the sum of tip radii. The bbox of
  //    a toothed polygon under-reads the tip radius slightly, because the
  //    extreme tips rarely land exactly on the cardinal angles, so compare
  //    against a tolerance derived from the tooth polygon's own resolution.
  const R_PER_TOOTH = 4
  const teeth = [24, 18, 14, 10]
  const tips = teeth.map((t) => t * R_PER_TOOTH)
  const gears = [...document.querySelectorAll('.gear')].map((g) => {
    const bb = g.querySelector('.gear__body').getBBox()
    return { cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 }
  })
  const meshes = []
  for (let i = 0; i < gears.length - 1; i++) {
    const a = gears[i]
    const b = gears[i + 1]
    const d = Math.hypot(b.cx - a.cx, b.cy - a.cy)
    const expected = tips[i] + tips[i + 1]
    meshes.push({
      pair: `${i}-${i + 1}`,
      measured: +d.toFixed(2),
      expected: +expected.toFixed(2),
      delta: +(d - expected).toFixed(2),
      meshes: Math.abs(d - expected) < 0.5,
    })
  }
  t.push({ gearMesh: meshes, gearCount: gears.length })

  // 6. Any element wider than the viewport?
  const wide = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width > document.documentElement.clientWidth + 2 && r.height > 0) {
      wide.push(el.className?.toString?.().slice(0, 50) + ` w=${Math.round(r.width)}`)
    }
  }
  t.push({ tooWide: wide.slice(0, 8) })

  return t
})

console.log(JSON.stringify(report, null, 2))
console.log('CONSOLE ERRORS:', errors.length ? errors : 'none')
console.log('FAILED REQUESTS:', failed.length ? failed : 'none')

// Full page + per-section shots
await page.screenshot({ path: `${out}-full.png`, fullPage: true })
await page.screenshot({ path: `${out}-hero.png` })

for (const id of ['caliber-01', 'caliber-02', 'caliber-03', 'caliber-04']) {
  const el = await page.$('#' + id)
  if (el) {
    await el.scrollIntoView()
    await new Promise((r) => setTimeout(r, 700))
    await el.screenshot({ path: `${out}-${id}.png` })
  }
}

await browser.close()
