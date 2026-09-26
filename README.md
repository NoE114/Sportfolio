# Caliber 00 — a portfolio built as a precision instrument

Vite + React + TypeScript. Deploys to Netlify with Netlify Forms.

The design language is horological: a chronometer, a reduction gear train, a
tachymeter, a specification sheet. The functional core is a portfolio — a
specification sheet, a system diagram, a project vault and a contact console.

---

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build  ->  dist/
npm run preview  # serve the production build
```

Requires Node 22+ (pinned in `netlify.toml`). No environment variables are
required to run locally.

### Deploying to Netlify

The build config is already in `netlify.toml`: build `npm run build`, publish
`dist`. Then, once, in the Netlify UI:

1. **Site configuration → Forms → Enable form detection.** Without this the
   build never registers the form and submissions return 404.
2. **Forms → Submission notifications → Add notification → Email**, to route
   submissions to an inbox. This is what receives the mail.

Both are one-time UI settings; nothing else is required.

### Filling in your own content

Two files hold every fact on the page. Nothing is hardcoded in a component.

- **`src/config/site.ts`** — name, role, statement, location, links, hero copy.
  Placeholders are wrapped in `[ BRACKETS ]` so they are greppable and render as
  a field awaiting a value.
- **`src/data/projects.ts`** — the chrono vault. Every fact-bearing field is
  `string | null`, and `null` renders as **NOT RECORDED** rather than as a
  plausible value.
- **`src/data/calibration.ts`** — the specification sheet and the gear matrix.

---

## Architecture

```
src/
├─ config/site.ts              identity, links, hero copy
├─ data/
│  ├─ projects.ts              project schema, explicit nulls
│  └─ calibration.ts           spec rows, gear matrix, relations
├─ lib/
│  ├─ timekeeping.ts           ← the clock domain
│  ├─ activity.ts              ← the scroll-velocity domain
│  ├─ tachymeter.ts            real scale generation
│  ├─ gearPath.ts              tooth / hand / arc path geometry
│  ├─ format.ts                locale-independent formatters
│  └─ audio.ts                 lazy mechanical transient
├─ hooks/useMovementClock.tsx  the single rAF loop + MotionContext
└─ components/
   ├─ chronometer/             Dial, Chronometer
   ├─ movement/                Caliber02 gear matrix + layout
   ├─ telemetry/               live measurement strip
   ├─ sections/                Caliber00, Caliber01, Footer
   ├─ projects/                Caliber03
   ├─ contact/                 Caliber04
   └─ ui/                      Nav, Instrument primitives, Grain
```

### The two domains, and why they are separate files

This is the central architectural decision, and it is enforced by module
boundaries rather than by discipline.

**`lib/timekeeping.ts` imports nothing.** No React, no DOM, no scroll state.
Everything shown as a *measurement* comes from here: wall clock, UTC, date,
session elapsed, chronograph elapsed, frame interval. There is no code path by
which scroll could influence a measurement, because there is no import that
would allow it.

**`lib/activity.ts` also imports nothing.** It reads scroll velocity and exposes
exactly one output: `drive`, a normalised 0..1 scalar. `drive` may modulate
*visual amplitude* — gear intensity, balance swing, the mechanism lamp. It
cannot reach a measurement.

The two coexist on the same animation frame without either being able to touch
the other. This is verified, not assumed — see the measurement scripts below.

### The single frame loop

One `requestAnimationFrame` loop for the whole page, in `useMovementClock.tsx`.
A chronometer running several independent loops is a chronometer with several
independent clocks, which is slower and a lie about its own subject.

Nothing re-renders React per frame. Frame data is written straight to the DOM
through refs, and writes are **change-guarded wherever a guard is sound** — see
below for where it is and is not.

The loop stops entirely when the tab is hidden and when nothing is subscribed.

### Where guarding pays, and where it does not

This was measured rather than assumed, and the answer was not the obvious one.

**The hands are guarded**, each at its own quantum derived from its own rate: the
hour hand at 0.05° (one write a minute instead of sixty), the minute hand at
0.2°, the seconds hand at 0.5° — which divides its 6° beat step exactly, so the
grid costs no accuracy. Together these cut seconds-hand writes from 60/s to 12/s.

**The gear train is not guarded.** At 6–14 deg/s each wheel moves a visible
fraction of a degree per frame, so any quantum coarse enough to save a meaningful
number of writes also produces a visible step. An intermediate guard was
measured at a 0.48° rendered step against a 0.1° true rate — a 5× overshoot,
which is a stutter, not an optimisation. The train now writes every frame, and
`scripts/hand.mjs` asserts the rendered per-frame step stays within a factor of
two of each wheel's true rate (measured: 1.01 across all four).

Four attribute writes a frame is not worth trading visual quality for.

---

## The mechanism, and what is real

Nothing on this page is a faked measurement. The distinction between a real
instrument and decorative horology is maintained explicitly:

| Element | Status |
|---|---|
| UTC, local, date, session | Real, from the system clock via a monotonic anchor |
| Chronograph | A real stopwatch. Two pushers, real elapsed time, real reset |
| Tachymeter | A real scale. `reading = 3600 / elapsed_seconds`, `φ = 21600 / reading`. Reads the actual chronograph |
| Seconds hand | Real time, **quantised to 5 steps/sec**. This is what a mechanical watch does |
| 18,000 VPH | A real movement rate. A vibration is counted per direction of swing, so this is 2.5 Hz oscillation and 5 hand steps/sec — the balance wheel in the aperture is visible evidence of it |
| Gear mesh | Real. Two meshing gears counter-rotate at rates inversely proportional to tooth counts: `ω = −(N₁/N₂)ω₁` |
| Gear tooth counts | A design choice. Hence `SCHEMATIC — NOT TO SCALE` |
| Frame interval | Real, from actual animation frame deltas, sampled at 4 Hz |
| `TRANSPORT` | Real, from the Network Information API. Shown as `N/A` where not exposed |
| `BUILD` | Real Vite build hash, or `DEV` locally |
| Project metrics | **`null` renders as NOT RECORDED.** Never invented |

**Power reserve is not simulated.** There is no stored quantity that scrolling
recharges, because that would be decoration pretending to be mechanics.

**The tachymeter's printed range is 60–500**, i.e. 7.2 s to 60 s of elapsed
time. The digital readout shows `—` below one second rather than an
implausible figure, because a rate is not measurable below that floor.

### What scrolling actually does

Scroll velocity feeds only `drive`, which reaches: gear train intensity, balance
swing amplitude, and the `MECHANISM` lamp. That is the complete list. The
seconds hand, the chronograph, UTC and session elapsed are untouched by it, and
the mechanism keeps its beat when scrolling stops.

---

## Performance

Measured on the production build, 1600×1000, via `scripts/perf.mjs`:

| | |
|---|---|
| Requests | 7 total (1 document, 1 CSS, 1 JS, 2 font subsets, 1 favicon) |
| JS | 84.3 kB gzip |
| CSS | 7.3 kB gzip |
| Frame timing | 60 fps, p95 16.8 ms, **0 frames over 20 ms, 0% jank** |
| Long tasks | 0 |
| JS heap | 3.2 MB |
| DOM nodes | 1500 |

Headroom is large: a single frame writes four gear transforms, one balance
rotation, and the few text nodes whose displayed precision actually changed.

**No WebGL. No canvas. No animation library.** The dial, tachymeter and gear
train are static SVG whose geometry is generated once at mount; only transform
attributes are written per frame. GSAP, Lenis and Three.js were all evaluated
and all removed — with one loop and native scroll, they cost bytes and bought
nothing. Lenis in particular was dropped because it intercepts scroll, which
conflicts with the requirement that scroll velocity be the *only* thing driving
activity, and it adds a class of reduced-motion bugs for no visual gain.

Fonts are self-hosted variable subsets. The whole grain field is one inline SVG
`feTurbulence` at 2.5% alpha, generated by the browser, never animated.

## Accessibility

- Every interactive control is a real `<button>` or `<a>`.
- Gear components are focusable groups; hovering and focusing produce the same
  relation set, and the readout carries an explicit `aria-label` because flex
  `gap` is not exposed to assistive technology.
- The chronograph readout is `role="timer"`, which is correct for a value that
  updates continuously and must not interrupt a screen reader.
- **Reduced motion does not stop the clock.** The seconds hand falls back from
  5 Hz to 1 Hz — still a correct, working clock — the balance holds at rest, and
  scroll-driven activity is disabled. The in-page toggle can override the system
  preference in either direction, and the effective state is written to
  `data-motion` so CSS and the frame loop follow the same decision.
- All numerals are `tabular-nums`, so a changing readout never reflows.
- The project vault index is a proper `tablist` with arrow-key navigation.

## Responsive

Verified for no horizontal overflow and no oversized elements at 390, 834, 1280,
1920, 2560 and 3840 px.

Mobile is a **redesign, not a scale-down**. The hero order becomes identity →
thesis → instrument → supporting copy, so the reader learns whose page this is
before meeting the dial. The gear matrix switches from a horizontal train to a
vertical one with a shared label column, laid out from the same tooth counts
rather than transformed. Pushers and nav controls keep 44 px touch targets.

## Verification scripts

Not part of the build. Each asserts a claim made above.

```bash
npm run verify            # timekeeping/scroll separation, leaders, a11y, form
npm run verify:mechanism  # hand accuracy, gear mesh ratios, motion smoothness
npm run verify:perf       # frame timing, long tasks, network, DOM write profile
npm run shoot -- <url> <prefix> [w] [h]   # screenshots + overflow audit
```

`verify` is the important one: it starts the chronograph, scrolls violently, and
asserts the reported elapsed time matches wall-clock time to within 50 ms. That
is the guarantee this architecture exists to provide. Measured error: ~1–13 ms,
which is the sampling interval, not drift.

`verify:mechanism` is the one that keeps claims honest. It derives each gear's
expected rotation rate from the tooth counts alone and compares it against what
is rendered, checks that the seconds hand tracks the wall clock within its
deliberate quantisation, and measures rendered motion smoothness against each
wheel's true rate.

---

## Deliberately absent

No gradient backgrounds, no purple/blue AI gradients, no particles, no bento
grid, no glassmorphism, no glow on hover, no WebGL, no stock 3D, no fake
dashboard statistics, no decorative motion, no scroll-jacking, no fabricated
metrics. The two gradients that exist are a 3.5% dial recess and a 2% sapphire
reflection — material shading, not identity. Solid colours dominate the
composition.
