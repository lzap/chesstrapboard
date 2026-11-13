import { readFileSync } from 'node:fs'

const allowed = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'MPL-2.0', 'ISC', '0BSD'])
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
let count = 0
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path) continue
  if (!allowed.has(info.license)) throw new Error(`${path}: license ${info.license ?? 'missing'} needs review`)
  count += 1
}
if (readFileSync('node_modules/chess.js/LICENSE', 'utf8') !== readFileSync('public/licenses/chess.js-LICENSE.txt', 'utf8')) {
  throw new Error('Distributed chess.js notice does not match the installed package')
}
console.log(`Verified ${count} locked npm packages and the distributed chess.js license notice`)
