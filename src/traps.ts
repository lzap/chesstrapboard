import { Chess } from 'chess.js'
import type { SearchResult } from './engine'
import { fromUci } from './openings'

export type MistakeFrequency = 'off' | 'rare' | 'sometimes' | 'often'
export type MistakeSize = 'mild' | 'medium' | 'large'

export interface GeneratedOpportunity {
  fen: string
  ply: number
  cpuMove: string
  suggestedReply: string
  estimatedLossCp: number
}

export interface CandidateMistake {
  move: string
  reply: string
  lossCp: number
}

const chances: Record<MistakeFrequency, number> = { off: 0, rare: 0.1, sometimes: 0.25, often: 0.45 }
const bands: Record<MistakeSize, [number, number]> = { mild: [60, 160], medium: [160, 350], large: [350, 800] }

export function shouldAttemptMistake(frequency: MistakeFrequency, random: number): boolean {
  return random < chances[frequency]
}

export function mistakeBand(size: MistakeSize): [number, number] {
  return bands[size]
}

export function findCandidateMistake(fen: string, shallow: SearchResult, deep: SearchResult, size: MistakeSize): CandidateMistake | null {
  if (shallow.rootTurn !== deep.rootTurn) return null
  const shallowBest = shallow.lines.find((line) => line.rank === 1)
  const deepBest = deep.lines.find((line) => line.rank === 1)
  if (!shallowBest || !deepBest || shallowBest.score.kind !== 'cp' || deepBest.score.kind !== 'cp') return null
  const [minimum, maximum] = mistakeBand(size)
  const plausible = new Map(shallow.lines.filter((line) => line.score.kind === 'cp' && shallowBest.score.value - line.score.value <= 100).map((line) => [line.moves[0], line]))
  const candidates = deep.lines
    .filter((line) => line.rank > 1 && line.score.kind === 'cp' && line.moves.length > 1 && plausible.has(line.moves[0]))
    .map((line) => ({ move: line.moves[0], reply: line.moves[1], lossCp: deepBest.score.value - line.score.value, cpuScore: line.score.value }))
    .filter((candidate) => candidate.lossCp >= minimum && candidate.lossCp <= maximum && candidate.cpuScore <= -30 && legalReply(fen, candidate.move, candidate.reply))
    .sort((a, b) => a.lossCp - b.lossCp)
  const selected = candidates[0]
  return selected ? { move: selected.move, reply: selected.reply, lossCp: selected.lossCp } : null
}

function legalReply(fen: string, move: string, reply: string): boolean {
  try {
    const chess = new Chess(fen)
    chess.move(fromUci(move))
    chess.move(fromUci(reply))
    return true
  } catch {
    return false
  }
}
