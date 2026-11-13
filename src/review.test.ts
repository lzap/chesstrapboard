import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { buildReview, formatScore, moveAnnotation, reviewBudget, reviewPositions, ReviewSearchCache, whiteShare } from './review'
import type { SearchResult } from './engine'

describe('postgame review', () => {
  it('reuses bounded background searches and deepens opportunity positions', () => {
    const cache = new ReviewSearchCache()
    const result: SearchResult = { rootTurn: 'w', bestMove: 'e2e4', lines: [] }
    const deeper: SearchResult = { rootTurn: 'w', bestMove: 'd2d4', lines: [] }
    cache.store('fen', 500, 2, result)
    expect(cache.get('fen', 260, 2)).toBe(result)
    expect(cache.get('fen', 850, 2)).toBeNull()
    expect(cache.get('fen', 260, 3)).toBeNull()
    cache.store('fen', 1200, 2, deeper)
    cache.store('fen', 260, 2, result)
    expect(cache.get('fen', 850, 2)).toBe(deeper)
    cache.clear()
    expect(cache.get('fen', 260, 2)).toBeNull()

    const opportunities = [{ fen: 'fen', ply: 4, cpuMove: 'e7e5', suggestedReply: 'e2e4', estimatedLossCp: 100 }]
    expect(reviewBudget(3, opportunities)).toBe(260)
    expect(reviewBudget(4, opportunities)).toBe(850)
    expect(reviewBudget(6, opportunities, true)).toBe(1200)
    expect(reviewBudget(7, opportunities, true)).toBe(500)
  })

  it.each([
    { move: 'f3', before: 100, after: 0, second: null, mark: '' },
    { move: 'f3', before: 100, after: 100, second: null, mark: '?' },
    { move: 'f3', before: 100, after: 400, second: null, mark: '??' },
    { move: 'e4', before: 100, after: -100, second: -80, mark: '!' },
    { move: 'e4', before: 450, after: -450, second: 0, mark: '!!' },
    { move: 'e4', before: 100, after: -100, second: null, mark: '' },
  ])('uses sparse beginner-friendly annotations for $move at $before/$after', ({ move, before, after, second, mark }) => {
    const chess = new Chess()
    chess.move(move)
    const moves = chess.history({ verbose: true })
    const positions: SearchResult[] = [
      { rootTurn: 'w', bestMove: 'e2e4', lines: [
        { rank: 1, depth: 12, score: { kind: 'cp', value: before }, moves: ['e2e4'] },
        ...(second === null ? [] : [{ rank: 2, depth: 12, score: { kind: 'cp' as const, value: second }, moves: ['d2d4'] }]),
      ] },
      { rootTurn: 'b', bestMove: 'e7e5', lines: [{ rank: 1, depth: 12, score: { kind: 'cp', value: after }, moves: ['e7e5'] }] },
    ]
    expect(buildReview(moves, positions, []).entries[0].annotation).toBe(mark)
  })

  it('lets opportunity replies override the general move annotation', () => {
    expect(moveAnnotation({ annotation: '??', replyFound: true })).toBe('!')
    expect(moveAnnotation({ annotation: '!!', replyFound: false })).toBe('?')
    expect(moveAnnotation({ annotation: '?', replyFound: undefined })).toBe('?')
  })

  it('marks a newly allowed mate and a missed forced mate', () => {
    const chess = new Chess()
    chess.move('f3')
    const moves = chess.history({ verbose: true })
    const position = (rootTurn: 'w' | 'b', kind: 'cp' | 'mate', value: number): SearchResult => ({
      rootTurn, bestMove: 'e2e4', lines: [{ rank: 1, depth: 12, score: { kind, value }, moves: ['e2e4'] }],
    })
    expect(buildReview(moves, [position('w', 'cp', 0), position('b', 'mate', 2)], []).entries[0].annotation).toBe('??')
    expect(buildReview(moves, [position('w', 'mate', 3), position('b', 'cp', -100)], []).entries[0].annotation).toBe('?')
    expect(buildReview(moves, [position('w', 'mate', 3), position('b', 'mate', -4)], []).entries[0].annotation).toBe('')
  })

  it('grades an actual missed opportunity from the mover’s perspective', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('f6')
    chess.move('d4')
    const moves = chess.history({ verbose: true })
    const positions: SearchResult[] = [
      { rootTurn: 'w', bestMove: 'e2e4', lines: [{ rank: 1, depth: 12, score: { kind: 'cp', value: 20 }, moves: ['e2e4'] }] },
      { rootTurn: 'b', bestMove: 'e7e5', lines: [{ rank: 1, depth: 12, score: { kind: 'cp', value: -20 }, moves: ['e7e5'] }] },
      { rootTurn: 'w', bestMove: 'e4e5', lines: [{ rank: 1, depth: 12, score: { kind: 'cp', value: 220 }, moves: ['e4e5'] }] },
      { rootTurn: 'b', bestMove: 'g7g6', lines: [{ rank: 1, depth: 12, score: { kind: 'cp', value: -50 }, moves: ['g7g6'] }] },
    ]
    const review = buildReview(moves, positions, [{ fen: moves[1].before, ply: 1, cpuMove: 'f7f6', suggestedReply: 'e4e5', estimatedLossCp: 220 }])
    expect(review.entries[1].lossCp).toBe(200)
    expect(review.entries[1].grade).toBe('mistake')
    expect(review.entries[1].opportunity).toBe('missed')
    expect(review.entries[2].replyFound).toBe(false)
    expect(review.entries[2].bestSan).toBe('e5')
    expect(review.initialScore).toEqual({ kind: 'cp', value: 20 })
    expect(review.missed).toBe(1)
  })

  it('formats evaluation for either side and mate', () => {
    expect(formatScore({ kind: 'cp', value: -85 })).toBe('-0.8')
    expect(formatScore({ kind: 'mate', value: 3 })).toBe('M3')
    expect(whiteShare({ kind: 'cp', value: 0 })).toBe(50)
    expect(whiteShare({ kind: 'mate', value: -2 })).toBe(0)
  })

  it('credits the best reply despite modest postgame score drift', () => {
    const chess = new Chess()
    for (const move of ['e4', 'f6', 'e5']) chess.move(move)
    const moves = chess.history({ verbose: true })
    const positions: SearchResult[] = [
      { rootTurn: 'w', bestMove: 'e2e4', lines: [{ rank: 1, depth: 10, score: { kind: 'cp', value: 20 }, moves: ['e2e4'] }] },
      { rootTurn: 'b', bestMove: 'e7e5', lines: [{ rank: 1, depth: 10, score: { kind: 'cp', value: -20 }, moves: ['e7e5'] }] },
      { rootTurn: 'w', bestMove: 'e4e5', lines: [{ rank: 1, depth: 10, score: { kind: 'cp', value: 70 }, moves: ['e4e5'] }] },
      { rootTurn: 'b', bestMove: 'g7g6', lines: [{ rank: 1, depth: 10, score: { kind: 'cp', value: -250 }, moves: ['g7g6'] }] },
    ]
    const opportunity = { fen: moves[1].before, ply: 1, cpuMove: 'f7f6', suggestedReply: 'e4e5', estimatedLossCp: 70 }
    const review = buildReview(moves, positions, [opportunity])
    expect(review.entries[1].lossCp).toBe(50)
    expect(review.entries[1].opportunity).toBe('used')
    expect(review.entries[2].replyFound).toBe(true)
    expect(review.used).toBe(1)
    const vanished = { ...positions[2], lines: [{ ...positions[2].lines[0], score: { kind: 'cp' as const, value: 25 } }] }
    const shiftedReview = buildReview(moves, [...positions.slice(0, 2), vanished, positions[3]], [opportunity])
    expect(shiftedReview.entries[1].opportunity).toBe('unconfirmed')
    expect(shiftedReview.entries[2].replyFound).toBe(true)
  })

  it('underlines a mate opportunity and marks a reply that preserves mate', () => {
    const chess = new Chess()
    for (const move of ['e4', 'f6', 'e5']) chess.move(move)
    const moves = chess.history({ verbose: true })
    const positions: SearchResult[] = [
      { rootTurn: 'w', bestMove: 'e2e4', lines: [{ rank: 1, depth: 12, score: { kind: 'cp', value: 0 }, moves: ['e2e4'] }] },
      { rootTurn: 'b', bestMove: 'e7e5', lines: [{ rank: 1, depth: 12, score: { kind: 'cp', value: 0 }, moves: ['e7e5'] }] },
      { rootTurn: 'w', bestMove: 'e4e5', lines: [{ rank: 1, depth: 12, score: { kind: 'mate', value: 3 }, moves: ['e4e5'] }] },
      { rootTurn: 'b', bestMove: 'g7g6', lines: [{ rank: 1, depth: 12, score: { kind: 'mate', value: -2 }, moves: ['g7g6'] }] },
    ]
    const opportunity = { fen: moves[1].before, ply: 1, cpuMove: 'f7f6', suggestedReply: 'd2d4', estimatedLossCp: 0, mate: true }
    const review = buildReview(moves, positions, [opportunity])
    expect(review.entries[1].opportunity).toBe('used')
    expect(review.entries[2].replyFound).toBe(true)
    expect(moveAnnotation(review.entries[2])).toBe('!')
    const missed = buildReview(moves, [positions[0], positions[1], positions[2], { ...positions[3], lines: [{ ...positions[3].lines[0], score: { kind: 'cp', value: -100 } }] }], [opportunity])
    expect(missed.entries[1].opportunity).toBe('missed')
    expect(moveAnnotation(missed.entries[2])).toBe('?')
  })

  it('keeps the full principal variation for the hover text', () => {
    const chess = new Chess()
    chess.move('e4')
    const moves = chess.history({ verbose: true })
    const positions: SearchResult[] = [
      { rootTurn: 'w', bestMove: 'e2e4', lines: [{ rank: 1, depth: 14, score: { kind: 'cp', value: 20 }, moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'] }] },
      { rootTurn: 'b', bestMove: 'e7e5', lines: [{ rank: 1, depth: 14, score: { kind: 'cp', value: -20 }, moves: ['e7e5'] }] },
    ]
    expect(buildReview(moves, positions, []).entries[0].bestLine).toBe('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6')
  })

  it('lists reached positions in move order for incremental review', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    const moves = chess.history({ verbose: true })
    expect(reviewPositions(chess)).toEqual([moves[0].before, moves[0].after, moves[1].after])
  })

  it('includes the setup position when a game starts from an opening FEN', () => {
    const chess = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3')
    expect(reviewPositions(chess)).toEqual([chess.fen()])
  })
})
