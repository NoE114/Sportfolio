// Performance measurement. Not part of the app build.
//   node scripts/perf.mjs <url>
import puppeteer from 'puppeteer'

const url = process.argv[2] ?? 'http://127.0.0.1:4195/'
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })

const byType = {}
let resourceBytes = 0
let encodedBytes = 0
page.on('response', async (r) => {
  const t = r.request().resourceType()
  byType[t] = (byType[t] ?? 0) + 1
  try {
    const len = Number(r.headers()['content-length'] ?? 0)
    if (len) {
      encodedBytes += len
    } else {
      const buf = await r.buffer()
      resourceBytes += buf.length
    }
  } catch {
    /* body unavailable for redirects and some cached responses */
  }
})

await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 2500))

const frameTiming = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const frames = []
  let last = performance.now()
  let running = true
  const tick = (t) => {
    frames.push(t - last)
    last = t
    if (running) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  await wait(1500) // idle
  for (let i = 0; i < 30; i++) {
    window.scrollBy(0, 600)
    await wait(16)
  }
  await wait(1500) // settle
  running = false

  const d = frames.slice(2).sort((a, b) => a - b)
  const pct = (p) => d[Math.floor(d.length * p)]
  const mean = d.reduce((a, b) => a + b, 0) / d.length
  const over = d.filter((x) => x > 20).length
  return {
    frames: d.length,
    meanMs: +mean.toFixed(2),
    medianMs: +pct(0.5).toFixed(2),
    p95Ms: +pct(0.95).toFixed(2),
    worstMs: +d[d.length - 1].toFixed(2),
    fps: +(1000 / mean).toFixed(1),
    framesOver20ms: over,
    jankPercent: +((over / d.length) * 100).toFixed(2),
  }
})

const longTasks = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const tasks = []
  let obs
  try {
    obs = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) tasks.push(+e.duration.toFixed(1))
    })
    obs.observe({ entryTypes: ['longtask'] })
  } catch {
    return 'unsupported'
  }
  for (let i = 0; i < 30; i++) {
    window.scrollBy(0, 500)
    await wait(16)
  }
  await wait(500)
  obs.disconnect()
  return { count: tasks.length, longestMs: tasks.length ? Math.max(...tasks) : 0 }
})

const metrics = await page.metrics()

console.log(
  JSON.stringify(
    {
      network: {
        requests: Object.values(byType).reduce((a, b) => a + b, 0),
        byType,
        kbOnWire: +((encodedBytes + resourceBytes) / 1024).toFixed(1),
      },
      frameTiming,
      longTasks,
      jsHeapMB: +(metrics.JSHeapUsedSize / 1048576).toFixed(2),
      domNodes: metrics.Nodes,
    },
    null,
    2,
  ),
)
await browser.close()
