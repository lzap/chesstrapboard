import { Chess, type Color, type Move } from 'chess.js'
import { tryMove, type MoveInput } from './chess'
import { fromUci, toUci, type Opening } from './openings'
import type { GeneratedOpportunity } from './traps'

export class TrainingSession {
  readonly chess = new Chess()
  readonly opening: Opening
  readonly playerColor: Color
  bookActive = true
  openingReached = false
  completed = false
  feedback = ''
  finishReason: 'resigned' | 'stopped' | null = null
  readonly opportunities: GeneratedOpportunity[] = []

  constructor(opening: Opening, playerColor: Color) {
    this.opening = opening
    this.playerColor = playerColor
    this.advanceBook()
  }

  get isPlayerTurn(): boolean {
    return !this.completed && !this.chess.isGameOver() && this.chess.turn() === this.playerColor
  }

  get isCpuTurn(): boolean {
    return !this.completed && !this.chess.isGameOver() && this.chess.turn() !== this.playerColor
  }

  get nextBookMove(): string | undefined {
    return this.bookActive ? this.opening.moves[this.chess.history().length] : undefined
  }

  playPlayer(input: MoveInput): Move | null {
    if (!this.isPlayerTurn) return null
    const move = tryMove(this.chess, input)
    if (!move) return null
    this.feedback = ''
    if (toUci(move) !== this.opening.moves[this.chess.history().length - 1]) this.bookActive = false
    this.updateProgress()
    if (this.chess.isGameOver()) this.completed = true
    return move
  }

  playCpu(input: MoveInput): Move | null {
    if (!this.isCpuTurn) return null
    const move = tryMove(this.chess, input)
    if (!move) return null
    this.bookActive = false
    if (this.chess.isGameOver()) this.completed = true
    return move
  }

  finish(reason: 'resigned' | 'stopped'): void {
    if (this.completed) return
    this.completed = true
    this.finishReason = reason
    this.feedback = reason === 'resigned' ? 'You resigned. Review the game when ready.' : 'Game ended. Review the moves when ready.'
  }

  advanceBook(): Move | null {
    if (!this.isCpuTurn || !this.bookActive) return null
    const expected = this.nextBookMove
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

  private updateProgress(): void {
    if (this.bookActive && this.chess.history().length === this.opening.moves.length) {
      this.openingReached = true
    }
  }
}
