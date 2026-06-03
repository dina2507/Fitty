// Rasterizes the Fitty SVG art into icon/splash sources for @capacitor/assets.
import sharp from 'sharp'
import { readFileSync, mkdirSync, writeFileSync } from 'fs'

mkdirSync('assets', { recursive: true })

const iconSvg = readFileSync('public/icons/icon.svg')
const maskable = readFileSync('public/icons/maskable.svg', 'utf8')

// Adaptive foreground = the maskable art minus its full-bleed background (transparent,
// glyph already scaled into the safe zone).
const foregroundSvg = maskable.replace(/<rect width="1024" height="1024" fill="url\(#bg\)"\s*\/>/, '')

// Adaptive background = the charcoal gradient only.
const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#27272a"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#bg)"/></svg>`

await sharp(iconSvg).resize(1024, 1024).png().toFile('assets/icon-only.png')
await sharp(Buffer.from(foregroundSvg)).resize(1024, 1024).png().toFile('assets/icon-foreground.png')
await sharp(Buffer.from(backgroundSvg)).resize(1024, 1024).png().toFile('assets/icon-background.png')

// Splash: centered logo on a dark canvas.
const logo = await sharp(iconSvg).resize(760, 760).png().toBuffer()
const splash = await sharp({ create: { width: 2732, height: 2732, channels: 4, background: { r: 24, g: 24, b: 27, alpha: 1 } } })
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toBuffer()
writeFileSync('assets/splash.png', splash)
writeFileSync('assets/splash-dark.png', splash)

console.log('Icon/splash sources written to assets/')
