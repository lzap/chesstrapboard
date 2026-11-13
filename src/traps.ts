import { Chess } from 'chess.js'
import type { SearchResult } from './engine'
import { fromUci, toUci } from './openings'

export type MistakeFrequency = 'off' | 'rare' | 'sometimes' | 'often' | 'almostAlways'
export type MistakeSize = 'mild' | 'medium' | 'large'

export interface GeneratedOpportunity {
  fen: string
  ply: number
  cpuMove: string
  suggestedReply: string
  estimatedLossCp: number
  mate?: boolean
  source?: 'discovered'
}

export interface CandidateMistake {
  move: string
  reply: string
  lossCp: number
  mate?: boolean
}

const chances: Record<MistakeFrequency, number> = { off: 0, rare: 0.25, sometimes: 0.5, often: 0.85, almostAlways: 0.95 }
const bands: Record<MistakeSize, [number, number]> = { mild: [30, 100], medium: [60, 250], large: [150, 800] }
const plausibleLoss: Record<MistakeSize, number> = { mild: 100, medium: 150, large: 200 }
export const nearEqualThresholdCp = 20

export function selectEngineMove(fen: string, result: SearchResult, random = Math.random): string | null {
  const legal = new Set(new Chess(fen).moves({ verbose: true }).map(toUci))
  const first = result.lines.find((line) => line.rank === 1)
  const second = result.lines.find((line) => line.rank === 2)
  const best = first?.moves[0] && legal.has(first.moves[0]) ? first.moves[0]
    : result.bestMove && legal.has(result.bestMove) ? result.bestMove : null
  if (!best) return null
  const alternative = second?.moves[0]
  if (first?.moves[0] === best && first.score.kind === 'cp' && second?.score.kind === 'cp'
    && alternative && alternative !== best && legal.has(alternative)
    && Math.abs(first.score.value - second.score.value) <= nearEqualThresholdCp) {
    return random() < 0.5 ? best : alternative
  }
  return best
}

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
  if (!shallowBest || !deepBest || shallowBest.score.kind !== 'cp'
    || deepBest.score.kind === 'mate' && deepBest.score.value <= 0) return null
  const [minimum, maximum] = mistakeBand(size)
  const plausible = new Map(shallow.lines.filter((line) => line.score.kind === 'cp' && shallowBest.score.value - line.score.value <= plausibleLoss[size]).map((line) => [line.moves[0], line]))
  const candidates = deep.lines
    .filter((line) => line.rank > 1 && line.moves.length > 1 && plausible.has(line.moves[0]))
    .map((line) => ({
      move: line.moves[0], reply: line.moves[1],
      mate: line.score.kind === 'mate' && line.score.value < 0,
      lossCp: deepBest.score.kind === 'cp' && line.score.kind === 'cp' ? deepBest.score.value - line.score.value : 0,
      cpuScore: line.score.kind === 'cp' ? line.score.value : 0,
    }))
    .filter((candidate) => (candidate.mate || deepBest.score.kind === 'cp' && candidate.lossCp >= minimum && candidate.lossCp <= maximum && candidate.cpuScore <= -30)
      && legalReply(fen, candidate.move, candidate.reply))
    .sort((a, b) => Number(b.mate) - Number(a.mate)
      || Math.abs(a.lossCp - (minimum + maximum) / 2) - Math.abs(b.lossCp - (minimum + maximum) / 2) || a.lossCp - b.lossCp)
  const selected = candidates[0]
  return selected ? { move: selected.move, reply: selected.reply, lossCp: selected.lossCp, ...(selected.mate ? { mate: true } : {}) } : null
}

export function confirmCandidateMistake(fen: string, root: SearchResult, after: SearchResult, candidate: CandidateMistake, size: MistakeSize): CandidateMistake | null {
  if (root.rootTurn === after.rootTurn) return null
  const rootBest = root.lines.find((line) => line.rank === 1)
  const replyBest = after.lines.find((line) => line.rank === 1)
  const reply = replyBest?.moves[0]
  if (!reply || !legalReply(fen, candidate.move, reply)) return null
  if (candidate.mate) {
    if (replyBest?.score.kind !== 'mate' || replyBest.score.value <= 0) return null
    return { move: candidate.move, reply, lossCp: 0, mate: true }
  }
  if (rootBest?.score.kind !== 'cp' || replyBest?.score.kind !== 'cp') return null
  const lossCp = rootBest.score.value + replyBest.score.value
  const [minimum, maximum] = mistakeBand(size)
  if (replyBest.score.value < 30 || lossCp < minimum || lossCp > maximum) return null
  return { move: candidate.move, reply, lossCp }
}

export function findMateReply(fen: string, result: SearchResult): string | null {
  if (result.rootTurn !== (fen.split(' ')[1] === 'b' ? 'b' : 'w')) return null
  const best = result.lines.find((line) => line.rank === 1)
  if (best?.score.kind !== 'mate' || best.score.value <= 0 || !best.moves[0]) return null
  try {
    new Chess(fen).move(fromUci(best.moves[0]))
    return best.moves[0]
  } catch {
    return null
  }
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
