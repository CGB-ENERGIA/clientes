const fs = require('fs')
const path = require('path')

const marker = "lockFiles = [ 'bun.lockb', 'bun.lock' ]"
const root = path.join(__dirname, '..', 'node_modules')

function walk (dir, matches = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, matches)
    } else if (entry.name === 'node-packager.js' && fullPath.includes('@quasar' + path.sep + 'app-vite')) {
      matches.push(fullPath)
    }
  }
  return matches
}

function patchFile (target) {
  let source = fs.readFileSync(target, 'utf8')

  if (source.includes(marker)) {
    return false
  }

  source = source.replace(
    "class Bun extends PackageManager {\n  name = 'bun'\n  lockFile = 'bun.lockb'",
    `class Bun extends PackageManager {
  name = 'bun'
  lockFile = 'bun.lockb'
  lockFiles = [ 'bun.lockb', 'bun.lock' ]

  isUsed () {
    let directory = appPaths.appDir

    while (directory.length && directory[ directory.length - 1 ] !== sep) {
      for (const lockFile of this.lockFiles) {
        if (fs.existsSync(join(directory, lockFile))) {
          return true
        }
      }

      directory = normalize(join(directory, '..'))
    }

    return false
  }`
  )

  source = source.replace(
    `  const pnpm = new Pnpm()

  if (pnpm.isUsed()) {
    return pnpm
  }

  const npm = new Npm()

  if (npm.isUsed()) {
    return npm
  }

  const bun = new Bun()

  if (bun.isUsed()) {
    return bun
  }

  if (yarn.isInstalled()) {
    return yarn
  }

  if (pnpm.isInstalled()) {
    return pnpm
  }

  if (npm.isInstalled()) {
    return npm
  }

  if (bun.isInstalled()) {
    return bun
  }

  fatal('Please install Yarn, PNPM, or NPM before running this command.\\n')`,
    `  const bun = new Bun()

  if (bun.isUsed()) {
    return bun
  }

  const pnpm = new Pnpm()

  if (pnpm.isUsed()) {
    return pnpm
  }

  const npm = new Npm()

  if (npm.isUsed()) {
    return npm
  }

  if (yarn.isInstalled()) {
    return yarn
  }

  if (bun.isInstalled()) {
    return bun
  }

  if (pnpm.isInstalled()) {
    return pnpm
  }

  if (npm.isInstalled()) {
    return npm
  }

  fatal('Please install Yarn, PNPM, NPM, or Bun before running this command.\\n')`
  )

  fs.writeFileSync(target, source)
  return true
}

if (!fs.existsSync(root)) {
  process.exit(0)
}

const files = walk(root)
let patched = 0

for (const file of files) {
  if (patchFile(file)) {
    patched++
  }
}

if (patched > 0) {
  console.log(`Patched Quasar bun detection in ${ patched } file(s)`)
}
