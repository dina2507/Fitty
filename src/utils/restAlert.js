// Audible + visual alert for when the rest timer ends. Works even when the tab
// is backgrounded (WebAudio beep) and flashes the tab title.

let audioCtx = null

function getCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  return audioCtx
}

// Call once on a user gesture (e.g. starting the timer) so mobile browsers
// allow audio later when the timer finishes in the background.
export function primeAudio() {
  const ctx = getCtx()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

function beep(ctx, freq, start, duration) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

export function playRestEndAlert({ vibrate = true } = {}) {
  // sound — two short rising beeps
  try {
    const ctx = getCtx()
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      const t = ctx.currentTime
      beep(ctx, 660, t, 0.18)
      beep(ctx, 880, t + 0.22, 0.22)
    }
  } catch { /* ignore */ }

  // vibration (only when document focused on most browsers)
  if (vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200]) } catch { /* ignore */ }
  }

  // tab-title flash if the tab is hidden
  if (typeof document !== 'undefined' && document.hidden) {
    const original = document.title
    let count = 0
    const id = setInterval(() => {
      document.title = count % 2 === 0 ? '⏱️ Rest done!' : original
      count += 1
      if (count > 6 || !document.hidden) {
        clearInterval(id)
        document.title = original
      }
    }, 600)
  }
}
