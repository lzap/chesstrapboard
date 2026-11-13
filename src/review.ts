import { Chess, type Move } from 'chess.js'
import { scoreForWhite, type EngineScore, type SearchResult } from './engine'
import { fromUci, toUci } from './openings'
import type { GeneratedOpportunity } from './traps'

export type Grade = 'best' | 'inaccuracy' | 'mistake' | 'blunder' | 'unrated'
export type OpportunityOutcome = 'used' | 'partial' | 'missed' | 'unconfirmed' | 'no-reply'

export interface ReviewEntry {
  ply: number
  san: string
  color: 'w' | 'b'
  bestSan: string | null
  bestLine: string
  bestMoves: string[]
  lossCp: number | null
  grade: Grade
  whiteScore: EngineScore | null
  opportunity?: OpportunityOutcome
  replyFound?: boolean
}

export interface GameReview {
  initialScore: EngineScore | null
  entries: ReviewEntry[]
  generated: number
  used: number
  missed: number
}

export function formatScore(score: EngineScore | null): string {
  if (!score) return '—'
  if (score.kind === 'mate') return score.value > 0 ? `M${score.value}` : score.value < 0 ? `-M${-score.value}` : 'M0'
  return `${score.value >= 0 ? '+' : ''}${(score.value / 100).toFixed(1)}`
}

export function whiteShare(score: EngineScore | null): number {
  if (!score) return 50
  if (score.kind === 'mate') return score.value > 0 ? 100 : 0
  return Math.max(2, Math.min(98, 50 + 48 * Math.tanh(score.value / 400)))
}

function gradeLoss(loss: number | null): Grade {
  if (loss === null) return 'unrated'
  if (loss <= 30) return 'best'
  if (loss <= 100) return 'inaccuracy'
  if (loss <= 250) return 'mistake'
  return 'blunder'
}

function lineSan(fen: string, moves: string[]): string {
  const board = new Chess(fen)
  const line: string[] = []
  for (const uci of moves) {
    try { line.push(board.move(fromUci(uci)).san) } catch { break }
  }
  return line.join(' ')
}

export function buildReview(moves: Move[], positions: SearchResult[], opportunities: GeneratedOpportunity[]): GameReview {
  const entries: ReviewEntry[] = moves.map((move, ply) => {
    const before = positions[ply]
    const after = positions[ply + 1]
    const best = before?.lines.find((line) => line.rank === 1)
    const afterBest = after?.lines.find((line) => line.rank === 1)
    const lossCp = best?.score.kind === 'cp' && afterBest?.score.kind === 'cp'
      ? Math.max(0, best.score.value + afterBest.score.value)
      : null
    const bestSan = best?.moves[0] ? lineSan(move.before, [best.moves[0]]) : null
    const afterScore = afterBest ? scoreForWhite(afterBest.score, after.rootTurn) : null
    return {
      ply,
      san: move.san,
      color: move.color,
      bestSan,
      bestLine: best ? lineSan(move.before, best.moves) : '',
      bestMoves: best?.moves ?? [],
      lossCp,
      grade: gradeLoss(lossCp),
      whiteScore: afterScore,
    }
  })

  let used = 0
  let missed = 0
  for (const opportunity of opportunities) {
    const cpuEntry = entries[opportunity.ply]
    const replyEntry = entries[opportunity.ply + 1]
    if (!cpuEntry) continue
    let outcome: OpportunityOutcome
    const confirmationFloor = Math.min(60, Math.max(25, Math.round(opportunity.estimatedLossCp * 0.6)))
    if (cpuEntry.lossCp === null || cpuEntry.lossCp < confirmationFloor) outcome = 'unconfirmed'
    else if (!replyEntry) outcome = 'no-reply'
    else if (replyEntry.lossCp === null) outcome = 'unconfirmed'
    else if (replyEntry.lossCp <= 50 || (positions[opportunity.ply + 1]?.bestMove && toUci(moves[opportunity.ply + 1]) === positions[opportunity.ply + 1].bestMove)) outcome = 'used'
    else if (replyEntry.lossCp <= 120) outcome = 'partial'
    else outcome = 'missed'
    cpuEntry.opportunity = outcome
    if (replyEntry) {
      replyEntry.replyFound = toUci(moves[opportunity.ply + 1]) === opportunity.suggestedReply || outcome === 'used'
      if (replyEntry.replyFound) used += 1
      else missed += 1
    }
  }
  const initial = positions[0]?.lines.find((line) => line.rank === 1)
  return { initialScore: initial ? scoreForWhite(initial.score, positions[0].rootTurn) : null, entries, generated: opportunities.length, used, missed }
}

export async function analyzeGame(
  chess: Chess,
  search: (fen: string, milliseconds: number) => Promise<SearchResult>,
  opportunities: GeneratedOpportunity[],
  onProgress: (done: number, total: number) => void,
  cancelled: () => boolean,
): Promise<GameReview> {
  const moves = chess.history({ verbose: true })
  const positions = [moves[0]?.before ?? new Chess().fen(), ...moves.map((move) => move.after)]
  const results: SearchResult[] = new Array(positions.length)
  for (let index = positions.length - 1; index >= 0; index -= 1) {
    if (cancelled()) throw new Error('Review cancelled')
    const fen = positions[index]
    const shouldDeepen = opportunities.some((opportunity) => index === opportunity.ply || index === opportunity.ply + 1 || index === opportunity.ply + 2)
    results[index] = await search(fen, shouldDeepen ? 850 : 260)
    onProgress(positions.length - index, positions.length)
  }
  if (cancelled()) throw new Error('Review cancelled')
  return buildReview(moves, results, opportunities)
}
