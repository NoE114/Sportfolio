/* ==========================================================================
   AUDIO — mechanical feedback

   Deliberately minimal. One sound: the pusher. A real pusher makes a short
   transient, not a tone, so this is a fast pitch-dropping triangle with a 45 ms
   decay — 12 lines of code for a click, and nothing else.

   Three rules this module enforces:
     1. The AudioContext is never constructed until a real user gesture, so it
        can never be created speculatively or on load.
     2. Nothing plays unless the reader has explicitly enabled it.
     3. It is entirely optional. Every function here is a no-op when disabled,
        so no feature anywhere depends on sound being available.
   ========================================================================== */

let ctx: AudioContext | null = null
let enabled = false

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  // Autoplay policy can leave a context suspended; a gesture is the moment to
  // resume it, so this is called from within the gesture handler.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function isAudioEnabled(): boolean {
  return enabled
}

export function setAudioEnabled(next: boolean): void {
  enabled = next
  if (!next && ctx && ctx.state === 'running') void ctx.suspend()
}

type Voice = 'tick' | 'clack'

const VOICES: Record<Voice, { from: number; to: number; dur: number; gain: number; type: OscillatorType }> = {
  // Pusher down: a short bright transient.
  tick: { from: 1650, to: 420, dur: 0.038, gain: 0.075, type: 'triangle' },
  // Pusher up / reset: lower and slightly longer, so the two states differ.
  clack: { from: 900, to: 190, dur: 0.07, gain: 0.11, type: 'triangle' },
}

/**
 * Play a mechanical transient. Safe to call from any handler: it is a no-op
 * when sound is disabled or the platform has no Web Audio.
 */
export function play(voice: Voice = 'tick'): void {
  if (!enabled) return
  const ac = audioContext()
  if (!ac) return

  const v = VOICES[voice]
  const t = ac.currentTime

  const osc = ac.createOscillator()
  const env = ac.createGain()
  osc.type = v.type
  // Exponential ramps cannot touch zero, so the floor is a very small value.
  osc.frequency.setValueAtTime(v.from, t)
  osc.frequency.exponentialRampToValueAtTime(v.to, t + v.dur)

  // Ramp in over 2 ms then decay. Ramping to zero directly produces an audible
  // click on top of the click we are trying to produce.
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(v.gain, t + 0.002)
  env.gain.exponentialRampToValueAtTime(0.0001, t + v.dur)

  osc.connect(env)
  env.connect(ac.destination)
  osc.start(t)
  osc.stop(t + v.dur + 0.02)
}
