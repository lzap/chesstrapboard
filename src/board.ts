import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import type { MoveInput } from './chess'

const pieces: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
}
const names: Record<PieceSymbol, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
const files = 'abcdefgh'

export class BoardView {
  private chess = new Chess()
  private positionFen: string | null = null
  private orientation: Color = 'w'
  private selected: Square | null = null
  private promotion: { from: Square; to: Square } | null = null
  private focusSquare: Square | null = null
  private allowedColor: Color | null = null
  private inputEnabled = true
  private hint: MoveInput | null = null

  constructor(private container: HTMLElement, private onMove: (move: MoveInput) => void, private onBeforeSquare?: (square: Square) => boolean) {}

  update(chess: Chess, orientation: Color, allowedColor: Color | null = null, inputEnabled = true, hint: MoveInput | null = null): void {
    const fen = chess.fen()
    const changedPosition = this.positionFen !== fen
    const changedInteraction = this.orientation !== orientation || this.allowedColor !== allowedColor || this.inputEnabled !== inputEnabled
    if (changedPosition || changedInteraction) {
      this.selected = null
      this.promotion = null
    }
    if (!this.focusSquare && this.container.contains(document.activeElement) && document.activeElement instanceof HTMLButtonElement) {
      this.focusSquare = document.activeElement.dataset.square as Square | undefined ?? null
    }
    this.chess = chess
    this.positionFen = fen
    this.orientation = orientation
    this.allowedColor = allowedColor
    this.inputEnabled = inputEnabled
    this.hint = hint
    this.draw()
  }

  private draw(): void {
    const ranks = this.orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
    const fileOrder = this.orientation === 'w' ? [...files] : [...files].reverse()
    const lastMove = this.chess.history({ verbose: true }).at(-1)
    const legal = this.selected ? this.chess.moves({ square: this.selected, verbose: true }).map((move) => move.to) : []
    const squares = ranks.flatMap((rank) => fileOrder.map((file) => {
      const square = `${file}${rank}` as Square
      const piece = this.chess.get(square)
      const dark = (files.indexOf(file) + rank) % 2 === 0
      const classes = ['square', dark ? 'dark' : 'light']
      if (square === this.selected) classes.push('selected')
      if (legal.includes(square)) classes.push('legal')
      if (square === this.hint?.from) classes.push('hint-from')
      if (square === this.hint?.to) classes.push('hint-to')
      if (lastMove && (square === lastMove.from || square === lastMove.to)) classes.push('last-move')
      const label = (piece ? `${square}, ${piece.color === 'w' ? 'white' : 'black'} ${names[piece.type]}` : `${square}, empty`)
        + (square === this.hint?.from ? ', suggested move starts here' : square === this.hint?.to ? ', suggested move ends here' : '')
      const glyph = piece ? `<span class="piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}" aria-hidden="true">${pieces[piece.color][piece.type]}</span>` : ''
      return `<button type="button" class="${classes.join(' ')}" data-square="${square}" aria-label="${label}" aria-pressed="${square === this.selected}">${glyph}<span class="coordinate" aria-hidden="true">${square}</span></button>`
    })).join('')
    const promotion = this.promotion ? `<div class="promotion" role="dialog" aria-label="Choose promotion piece"><p>Promote to</p><div>${(['q', 'r', 'b', 'n'] as const).map((piece) => `<button type="button" data-promotion="${piece}" aria-label="Promote to ${names[piece]}">${pieces[this.chess.turn()][piece]}</button>`).join('')}</div></div>` : ''
    this.container.innerHTML = `<div class="board" role="group" aria-label="Chess board">${squares}</div>${promotion}`
    this.container.querySelectorAll<HTMLButtonElement>('[data-square]').forEach((button) => {
      button.addEventListener('click', () => this.handleSquare(button.dataset.square as Square))
    })
    this.container.querySelectorAll<HTMLButtonElement>('[data-promotion]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!this.promotion) return
        const { from, to } = this.promotion
        this.promotion = null
        this.onMove({ from, to, promotion: button.dataset.promotion as MoveInput['promotion'] })
      })
    })
    if (this.promotion) this.container.querySelector<HTMLButtonElement>('[data-promotion]')?.focus()
    else if (this.focusSquare) this.container.querySelector<HTMLButtonElement>(`[data-square="${this.focusSquare}"]`)?.focus()
    this.focusSquare = null
  }

  private handleSquare(square: Square): void {
    if (this.onBeforeSquare?.(square)) return
    if (this.promotion || this.chess.isGameOver() || !this.inputEnabled) return
    const piece = this.chess.get(square)
    if (this.selected) {
      const moves = this.chess.moves({ square: this.selected, verbose: true }).filter((move) => move.to === square)
      if (moves.length) {
        this.focusSquare = square
        if (moves.some((move) => move.isPromotion())) {
          this.promotion = { from: this.selected, to: square }
          this.draw()
        } else {
          this.onMove({ from: this.selected, to: square })
        }
        return
      }
    }
    this.focusSquare = square
    this.selected = piece?.color === this.chess.turn() && (this.allowedColor === null || piece.color === this.allowedColor) ? square : null
    this.draw()
  }
}
