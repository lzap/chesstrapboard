import { describe, expect, it } from 'vitest'
import { findCandidateMistake, shouldAttemptMistake } from './traps'
import type { SearchResult } from './engine'

const shallow: SearchResult = {
  rootTurn: 'b', bestMove: 'g8f6', lines: [
    { rank: 1, depth: 8, score: { kind: 'cp', value: 0 }, moves: ['g8f6', 'b1c3'] },
    { rank: 2, depth: 8, score: { kind: 'cp', value: -20 }, moves: ['f7f6', 'e4e5'] },
    { rank: 3, depth: 8, score: { kind: 'cp', value: -140 }, moves: ['d7d6', 'e4e5'] },
  ],
}
const deep: SearchResult = {
  rootTurn: 'b', bestMove: 'g8f6', lines: [
    { rank: 1, depth: 14, score: { kind: 'cp', value: 0 }, moves: ['g8f6', 'b1c3'] },
    { rank: 2, depth: 14, score: { kind: 'cp', value: -230 }, moves: ['f7f6', 'e4e5'] },
    { rank: 3, depth: 14, score: { kind: 'cp', value: -400 }, moves: ['d7d6', 'e4e5'] },
  ],
}
const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

describe('generated mistake selection', () => {
  it('separates frequency from the quality of an eligible mistake', () => {
    expect(shouldAttemptMistake('off', 0)).toBe(false)
    expect(shouldAttemptMistake('rare', 0.09)).toBe(true)
    expect(shouldAttemptMistake('rare', 0.10)).toBe(false)
    expect(shouldAttemptMistake('often', 0.44)).toBe(true)
  })

  it('requires a plausible short-search move with a deeper punishable downside', () => {
    expect(findCandidateMistake(fen, shallow, deep, 'medium')).toEqual({ move: 'f7f6', reply: 'e4e5', lossCp: 230 })
    expect(findCandidateMistake(fen, shallow, deep, 'mild')).toBeNull()
    expect(findCandidateMistake(fen, { ...shallow, rootTurn: 'w' }, deep, 'medium')).toBeNull()
  })

  it('does not treat mate scores as comparable centipawns', () => {
    const withMate: SearchResult = { ...deep, lines: [{ ...deep.lines[0], score: { kind: 'mate', value: 3 } }, ...deep.lines.slice(1)] }
    expect(findCandidateMistake(fen, shallow, withMate, 'medium')).toBeNull()
  })
})
