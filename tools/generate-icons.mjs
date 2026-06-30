/**
 * Tạo PNG icons cho PWA từ SVG
 * Chạy: node tools/generate-icons.mjs
 * Cần: npm install -D sharp
 */

import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '../public')
const svgPath   = path.join(publicDir, 'icon.svg')
const svgBuffer = fs.readFileSync(svgPath)

const sizes = [
  { name: 'icon-192.png',      size: 192 },
  { name: 'icon-512.png',      size: 512 },
  { name: 'icon-maskable.png', size: 512 },  // full-bleed cho maskable
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png',    size: 32  },
]

for (const { name, size } of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(path.join(publicDir, name))
  console.log(`✓ ${name} (${size}x${size})`)
}

console.log('\nDone! Copy vào public/ xong rồi.')
