import { Capacitor } from '@capacitor/core'

// Save a JSON backup string to a file the user controls.
// - Native (APK): writes to cache and opens the share sheet (save to Drive/Files/etc).
// - Web/PWA: triggers a normal browser download.
export async function saveBackupFile(filename, jsonString) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    await Filesystem.writeFile({
      path: filename,
      data: jsonString,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
    await Share.share({ title: 'Fitty backup', text: 'Fitty data backup', url: uri })
    return { method: 'share' }
  }

  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 500)
  return { method: 'download' }
}

export function backupFileName() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `fitty-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
}
