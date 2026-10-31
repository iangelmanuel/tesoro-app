// Genera los PNG de marca y el favicon desde los SVG fuente de assets/brand/.
// Uso: pnpm brand:assets. La salida se commitea; el CI no corre este script.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BRAND = path.join(ROOT, "assets/brand")

// [SVG fuente, ancho del SVG, salida, ancho, alto]
const PNG_TARGETS = [
  ["opengraph.svg", 1200, "public/opengraph-image.png", 1200, 630],
  ["logo.svg", 512, "public/brand/logo.png", 512, 512],
  ["mark.svg", 64, "public/apple-touch-icon.png", 180, 180],
  ["mark.svg", 64, "public/icons/icon-192.png", 192, 192],
  ["mark.svg", 64, "public/icons/icon-512.png", 512, 512]
]

const ICO_SIZES = [16, 32, 48]

// Rasteriza el SVG a la densidad justa para no escalar un bitmap
async function renderPng(source, sourceWidth, width, height) {
  const svg = await readFile(path.join(BRAND, source))
  return sharp(svg, { density: (72 * width) / sourceWidth })
    .resize(width, height)
    .png({ compressionLevel: 9 })
    .toBuffer()
}

// ICO con PNG embebidos: cabecera de 6 bytes + 16 bytes por entrada + datos
function buildIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)])
}

async function main() {
  for (const [source, sourceWidth, output, width, height] of PNG_TARGETS) {
    const file = path.join(ROOT, output)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, await renderPng(source, sourceWidth, width, height))
    console.log(`✓ ${output} (${width}×${height})`)
  }

  const icons = await Promise.all(
    ICO_SIZES.map(async (size) => ({
      size,
      data: await renderPng("mark.svg", 64, size, size)
    }))
  )
  await writeFile(path.join(ROOT, "app/favicon.ico"), buildIco(icons))
  console.log(`✓ app/favicon.ico (${ICO_SIZES.join(", ")})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
