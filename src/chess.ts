import { Chess, type Move, type Square } from 'chess.js'

export interface MoveInput {
  from: Square
  to: Square
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export function tryMove(chess: Chess, input: MoveInput): Move | null {
  try {
    return chess.move(input)
  } catch {
    return null
  }
}

export function gameResult(chess: Chess): string {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0'
  if (chess.isDraw()) return '1/2-1/2'
  return '*'
}

export function gameStatus(chess: Chess): string {
  if (chess.isCheckmate()) return `${chess.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`
  if (chess.isStalemate()) return 'Draw by stalemate'
  if (chess.isThreefoldRepetition()) return 'Draw by repetition'
  if (chess.isInsufficientMaterial()) return 'Draw by insufficient material'
  if (chess.isDrawByFiftyMoves()) return 'Draw by fifty-move rule'
  return `${chess.turn() === 'w' ? 'White' : 'Black'} to move${chess.isCheck() ? ' — check' : ''}`
}

export function exportPgn(chess: Chess, white = 'White', black = 'Black', opening?: { name: string; eco: string }, resultOverride?: string): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '.')
  chess.setHeader('Event', 'CHESS TRAP BOARD')
  chess.setHeader('Site', 'https://lzap.github.io/chesstrapboard/')
  chess.setHeader('Date', date)
  chess.setHeader('White', white)
  chess.setHeader('Black', black)
  chess.setHeader('Result', resultOverride ?? gameResult(chess))
  if (opening) {
    chess.setHeader('Opening', opening.name)
    chess.setHeader('ECO', opening.eco)
  } else {
    chess.removeHeader('Opening')
    chess.removeHeader('ECO')
  }
  return chess.pgn()
}
