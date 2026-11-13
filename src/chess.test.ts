import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { exportPgn, gameResult, gameStatus, tryMove } from './chess'

describe('game rules and export', () => {
  it('rejects illegal moves and accepts promotions', () => {
    const chess = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    expect(tryMove(chess, { from: 'e1', to: 'e8' })).toBeNull()
    expect(tryMove(chess, { from: 'a7', to: 'a8', promotion: 'n' })?.san).toContain('=N')
    expect(chess.get('a8')).toEqual({ type: 'n', color: 'w' })
  })

  it('exports a completed game with the correct result and opening headers', () => {
    const chess = new Chess()
    for (const move of ['f3', 'e5', 'g4', 'Qh4#']) chess.move(move)
    expect(gameResult(chess)).toBe('0-1')
    expect(gameStatus(chess)).toBe('Black wins by checkmate')
    const pgn = exportPgn(chess, 'Player', 'CPU', { name: 'Example', eco: 'A00' })
    expect(pgn).toContain('[White "Player"]')
    expect(pgn).toContain('[Result "0-1"]')
    expect(pgn).toContain('[Opening "Example"]')
    expect(pgn).toContain('1. f3 e5 2. g4 Qh4# 0-1')
  })
})
