import { Chess } from 'chess.js'
import type { MoveInput } from './chess'

export interface Opening {
  id: number
  eco: string
  name: string
  moves: string[]
  position: string
}

interface OpeningFile {
  version: number
  source: string
  commit: string
  openings: [string, string, string[], string][]
}

const featuredNames = ['Italian Game', 'Ruy Lopez', 'Sicilian Defense', "Queen's Gambit", 'French Defense', 'Caro-Kann Defense']

export async function loadOpenings(): Promise<Opening[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/openings.json`)
  if (!response.ok) throw new Error(`Opening file could not be loaded (${response.status})`)
  const file = await response.json() as OpeningFile
  if (file.version !== 1 || !Array.isArray(file.openings)) throw new Error('Opening file has an unsupported format')
  return file.openings.map(([eco, name, moves, position], id) => ({ id, eco, name, moves, position }))
}

export function searchOpenings(openings: Opening[], query: string, limit = 12): Opening[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) {
    return featuredNames.map((name) => openings.find((opening) => opening.name === name)).filter((opening): opening is Opening => Boolean(opening)).slice(0, limit)
  }
  const words = needle.split(/\s+/)
  return openings.filter((opening) => {
    const haystack = `${opening.eco} ${opening.name}`.toLocaleLowerCase()
    return words.every((word) => haystack.includes(word))
  }).slice(0, limit)
}

export function fromUci(uci: string): MoveInput {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error(`Invalid UCI move: ${uci}`)
  return { from: uci.slice(0, 2) as MoveInput['from'], to: uci.slice(2, 4) as MoveInput['to'], promotion: uci[4] as MoveInput['promotion'] }
}

export function toUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

export function openingSan(opening: Opening): string[] {
  const chess = new Chess()
  return opening.moves.map((uci) => chess.move(fromUci(uci)).san)
}

export function positionKey(chess: Chess): string {
  return chess.fen().split(' ').slice(0, 4).join(' ')
}

export function classifyGame(chess: Chess, openings: Opening[]): Opening | null {
  const byPosition = new Map(openings.map((opening) => [opening.position, opening]))
  for (const move of chess.history({ verbose: true }).reverse()) {
    const opening = byPosition.get(move.after.split(' ').slice(0, 4).join(' '))
    if (opening) return opening
  }
  return null
}
