import { Chess, type Color, type Move } from 'chess.js'
import { tryMove, type MoveInput } from './chess'
import { fromUci, toUci, type Opening, type OpeningBook } from './openings'
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
  private opportunityCheckPlies: number[] = []
  readonly opportunities: GeneratedOpportunity[] = []

  constructor(opening: Opening, playerColor: Color, private readonly book: OpeningBook) {
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

  get hasBookContinuation(): boolean {
    return Boolean(this.nextBookMove) || this.book.hasContinuation(this.chess)
  }

  get availableOpeningLength(): number {
    return Math.max(this.opening.moves.length, this.book.longestLinePly(this.chess))
  }

  get opportunityChecks(): number {
    return this.opportunityCheckPlies.length
  }

  get canTakeBack(): boolean {
    return this.chess.history({ verbose: true }).some((move) => move.color === this.playerColor)
  }

  recordOpportunityCheck(ply: number): void {
    this.opportunityCheckPlies.push(ply)
  }

  takeBack(): boolean {
    const history = this.chess.history({ verbose: true })
    const lastPlayerIndex = history.map((move) => move.color).lastIndexOf(this.playerColor)
    if (lastPlayerIndex < 0) return false
    for (let index = history.length - 1; index >= lastPlayerIndex; index -= 1) this.chess.undo()
    const remaining = this.chess.history({ verbose: true }).map(toUci)
    this.bookActive = remaining.every((move, index) => move === this.opening.moves[index])
    this.openingReached = remaining.length >= this.opening.moves.length && this.opening.moves.every((move, index) => move === remaining[index])
    this.opportunities.splice(0, this.opportunities.length, ...this.opportunities.filter((opportunity) => opportunity.ply < lastPlayerIndex))
    this.opportunityCheckPlies = this.opportunityCheckPlies.filter((ply) => ply < lastPlayerIndex)
    this.completed = false
    this.finishReason = null
    this.feedback = ''
    return true
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
    if (toUci(move) !== this.opening.moves[this.chess.history().length - 1]) this.bookActive = false
    this.updateProgress()
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
    if (!this.isCpuTurn) return null
    if (this.nextBookMove) {
      const move = tryMove(this.chess, fromUci(this.nextBookMove))
      if (move) {
        this.updateProgress()
        if (this.chess.isGameOver()) this.completed = true
        return move
      }
      this.bookActive = false
    }
    const choice = this.book.pickMove(this.chess)
    if (!choice) return null
    const move = tryMove(this.chess, fromUci(choice))
    if (!move) return null
    this.bookActive = false
    if (this.chess.isGameOver()) this.completed = true
    return move
  }

  private updateProgress(): void {
    if (this.bookActive && this.chess.history().length === this.opening.moves.length) {
      this.openingReached = true
    }
  }
}
