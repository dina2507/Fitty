import { Capacitor } from '@capacitor/core'

const KEY = 'fitty_haptics'

export const hapticsEnabled = () => localStorage.getItem(KEY) !== 'false'
export const setHapticsEnabled = (value) => localStorage.setItem(KEY, String(!!value))

// A short tap. style: 'light' | 'medium' | 'heavy'
export async function hapticImpact(style = 'medium') {
  if (!hapticsEnabled()) return
  if (Capacitor.isNativePlatform()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
      await Haptics.impact({ style: map[style] || ImpactStyle.Medium })
      return
    } catch { /* fall through to web vibrate */ }
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const ms = style === 'heavy' ? 40 : style === 'light' ? 12 : 22
    try { navigator.vibrate(ms) } catch { /* ignore */ }
  }
}

// A celebratory success pattern (e.g. new PR, finished workout).
export async function hapticSuccess() {
  if (!hapticsEnabled()) return
  if (Capacitor.isNativePlatform()) {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics')
      await Haptics.notification({ type: NotificationType.Success })
      return
    } catch { /* fall through */ }
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([30, 40, 30]) } catch { /* ignore */ }
  }
}
