import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const files = new Map([
  ['stockfish-19-lite-single.js', 'ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a'],
  ['stockfish-19-lite-single.wasm', 'ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de'],
])

for (const [file, expected] of files) {
  const actual = createHash('sha256').update(readFileSync(`public/engine/${file}`)).digest('hex')
  if (actual !== expected) throw new Error(`${file}: SHA-256 does not match the pinned release`)
}

const license = readFileSync('public/engine/COPYING-GPL-3.0.txt', 'utf8')
if (!license.includes('GNU GENERAL PUBLIC LICENSE') || !license.includes('Version 3')) throw new Error('Stockfish GPL notice is missing')
console.log('Verified Stockfish.js v19.0.1 engine assets and GPL notice')
