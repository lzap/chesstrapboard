import { Chess } from 'chess.js'
import type { SearchResult } from './engine'
import { fromUci } from './openings'

export type MistakeFrequency = 'off' | 'rare' | 'sometimes' | 'often' | 'always'
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

const chances: Record<MistakeFrequency, number> = { off: 0, rare: 0.1, sometimes: 0.25, often: 0.45, always: 1 }
const bands: Record<MistakeSize, [number, number]> = { mild: [30, 100], medium: [60, 250], large: [150, 800] }
const plausibleLoss: Record<MistakeSize, number> = { mild: 100, medium: 150, large: 200 }

export function shouldAttemptMistake(frequency: MistakeFrequency, random: number): boolean {
  return random < chances[frequency]
}

export function canSeekOpportunity(ply: number, openingPlyCount: number, generatedCount: number, lastGeneratedPly?: number): boolean {
  return Math.floor(ply / 2) + 1 >= 3
    && ply <= Math.min(36, Math.max(20, openingPlyCount + 10))
    && generatedCount < 3
    && (lastGeneratedPly === undefined || ply - lastGeneratedPly >= 6)
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
  const plausible = new Map(shallow.lines.filter((line) => line.score.kind === 'cp' && shallowBest.score.value - line.score.value <= plausibleLoss[size]).map((line) => [line.moves[0], line]))
  const candidates = deep.lines
    .filter((line) => line.rank > 1 && line.score.kind === 'cp' && line.moves.length > 1 && plausible.has(line.moves[0]))
    .map((line) => ({ move: line.moves[0], reply: line.moves[1], lossCp: deepBest.score.value - line.score.value, cpuScore: line.score.value }))
    .filter((candidate) => candidate.lossCp >= minimum && candidate.lossCp <= maximum && candidate.cpuScore <= -30 && legalReply(fen, candidate.move, candidate.reply))
    .sort((a, b) => Math.abs(a.lossCp - (minimum + maximum) / 2) - Math.abs(b.lossCp - (minimum + maximum) / 2) || a.lossCp - b.lossCp)
  const selected = candidates[0]
  return selected ? { move: selected.move, reply: selected.reply, lossCp: selected.lossCp } : null
}

export function confirmCandidateMistake(fen: string, root: SearchResult, after: SearchResult, candidate: CandidateMistake, size: MistakeSize): CandidateMistake | null {
  if (root.rootTurn === after.rootTurn) return null
  const rootBest = root.lines.find((line) => line.rank === 1)
  const replyBest = after.lines.find((line) => line.rank === 1)
  if (rootBest?.score.kind !== 'cp' || replyBest?.score.kind !== 'cp') return null
  const reply = replyBest.moves[0]
  const lossCp = rootBest.score.value + replyBest.score.value
  const [minimum, maximum] = mistakeBand(size)
  if (!reply || replyBest.score.value < 30 || lossCp < minimum || lossCp > maximum || !legalReply(fen, candidate.move, reply)) return null
  return { move: candidate.move, reply, lossCp }
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
