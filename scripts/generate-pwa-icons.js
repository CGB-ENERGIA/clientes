const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const sizes = [128, 144, 152, 167, 180, 192, 256, 384, 512]
const outDir = path.join(__dirname, '..', 'public', 'icons')
const input = path.join(__dirname, '..', 'public', 'logo.ico')

async function main () {
  if (!fs.existsSync(input)) {
    console.error('Missing public/logo.ico')
    process.exit(1)
  }

  fs.mkdirSync(outDir, { recursive: true })

  for (const size of sizes) {
    const filename = size === 144
      ? 'ms-icon-144x144.png'
      : [152, 167, 180].includes(size)
        ? `apple-icon-${size}x${size}.png`
        : `icon-${size}x${size}.png`

    await sharp(input)
      .resize(size, size, { fit: 'contain', background: { r: 6, g: 11, b: 20, alpha: 1 } })
      .png()
      .toFile(path.join(outDir, filename))

    console.log(`Created ${filename}`)
  }

  const safariSvg = path.join(
    __dirname,
    '..',
    'node_modules',
    '@quasar',
    'app-vite',
    'templates',
    'pwa-icons',
    'safari-pinned-tab.svg'
  )

  if (fs.existsSync(safariSvg)) {
    fs.copyFileSync(safariSvg, path.join(outDir, 'safari-pinned-tab.svg'))
    console.log('Copied safari-pinned-tab.svg')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
