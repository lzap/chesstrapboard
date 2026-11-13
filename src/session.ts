import { Chess, type Color, type Move } from 'chess.js'
import { tryMove, type MoveInput } from './chess'
import { fromUci, toUci, type Opening } from './openings'
import type { GeneratedOpportunity } from './traps'

export type Mode = 'memorize' | 'traps'

export class TrainingSession {
  readonly chess = new Chess()
  readonly opening: Opening
  readonly mode: Mode
  readonly playerColor: Color
  bookActive = true
  openingReached = false
  completed = false
  feedback = ''
  finishReason: 'resigned' | 'stopped' | null = null
  readonly opportunities: GeneratedOpportunity[] = []

  constructor(opening: Opening, mode: Mode, playerColor: Color) {
    this.opening = opening
    this.mode = mode
    this.playerColor = playerColor
    this.advanceBook()
  }

  get isPlayerTurn(): boolean {
    return !this.completed && !this.chess.isGameOver() && this.chess.turn() === this.playerColor
  }

  get isCpuTurn(): boolean {
    return !this.completed && !this.chess.isGameOver() && this.chess.turn() !== this.playerColor
  }

  get expected(): string | undefined {
    return this.bookActive ? this.opening.moves[this.chess.history().length] : undefined
  }

  playPlayer(input: MoveInput): Move | null {
    if (!this.isPlayerTurn) return null
    if (this.mode === 'memorize' && toUci(input) !== this.expected) {
      const expectedMove = this.expected && this.chess.moves({ verbose: true }).find((move) => toUci(move) === this.expected)
      this.feedback = expectedMove ? `Try ${expectedMove.san}. The line stays at this position.` : 'That is outside this opening line.'
      return null
    }
    const move = tryMove(this.chess, input)
    if (!move) return null
    this.feedback = ''
    if (this.mode === 'traps' && toUci(move) !== this.opening.moves[this.chess.history().length - 1]) this.bookActive = false
    this.updateProgress()
    if (this.chess.isGameOver()) this.completed = true
    if (this.mode === 'memorize') this.advanceBook()
    return move
  }

  playCpu(input: MoveInput): Move | null {
    if (!this.isCpuTurn || this.mode !== 'traps') return null
    const move = tryMove(this.chess, input)
    if (!move) return null
    this.bookActive = false
    if (this.chess.isGameOver()) this.completed = true
    return move
  }

  finish(reason: 'resigned' | 'stopped'): void {
    if (this.mode !== 'traps' || this.completed) return
    this.completed = true
    this.finishReason = reason
    this.feedback = reason === 'resigned' ? 'You resigned. Review the game when ready.' : 'Game ended. Review the moves when ready.'
  }

  advanceBook(): Move | null {
    if (!this.isCpuTurn || !this.bookActive) return null
    const expected = this.expected
    if (!expected) {
      this.updateProgress()
      return null
    }
    const move = tryMove(this.chess, fromUci(expected))
    if (!move) {
      this.bookActive = false
      return null
    }
    this.updateProgress()
    return move
  }

  undoPractice(): void {
    if (this.mode !== 'memorize') return
    if (!this.chess.history().length) return
    do {
      this.chess.undo()
    } while (this.chess.history().length && this.chess.turn() !== this.playerColor)
    this.completed = false
    this.openingReached = false
    this.feedback = 'Try this position again.'
  }

  private updateProgress(): void {
    if (this.bookActive && this.chess.history().length === this.opening.moves.length) {
      this.openingReached = true
      if (this.mode === 'memorize') {
        this.completed = true
        this.feedback = 'Line complete. Nice work!'
      }
    }
  }
}
