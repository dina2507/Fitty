// Tiny WebAudio sound effects — synthesized, no asset files (works offline).
let audioCtx = null
const KEY = 'fitty_sfx'

export const sfxEnabled = () => localStorage.getItem(KEY) !== 'false'
export const setSfxEnabled = (value) => localStorage.setItem(KEY, String(!!value))

function getCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

// Call on a user gesture so mobile allows audio later.
export function primeSfx() {
  getCtx()
}

function tone(freq, start, duration, peak = 0.16, type = 'sine') {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

// Soft pop — set saved.
export function playClick() {
  if (!sfxEnabled()) return
  const ctx = getCtx()
  if (!ctx) return
  tone(523.25, ctx.currentTime, 0.09, 0.12, 'triangle')
}

// Rising C–E–G chime — new personal record.
export function playPR() {
  if (!sfxEnabled()) return
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(523.25, t, 0.14, 0.18)
  tone(659.25, t + 0.12, 0.14, 0.18)
  tone(783.99, t + 0.24, 0.26, 0.2)
}

// Two-note flourish — workout finished.
export function playFinish() {
  if (!sfxEnabled()) return
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(587.33, t, 0.12, 0.16)
  tone(880, t + 0.12, 0.22, 0.18)
}
