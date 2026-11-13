import { Chess, type Color } from 'chess.js'
import { BoardView } from './board'
import { exportPgn, gameStatus } from './chess'
import { fromUci, loadOpenings, openingSan, searchOpenings, toUci, type Opening } from './openings'
import { TrainingSession } from './session'
import './style.css'

const element = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!
const previewChess = new Chess()
let openings: Opening[] = []
let selectedOpening: Opening | null = null
let session: TrainingSession | null = null
let playerColor: Color = 'w'
let orientation: Color = 'w'
let loadError = ''

const board = new BoardView(element('#board-container'), (input) => {
  if (!session) return
  session.playPlayer(input)
  render()
})

function expectedSan(current: TrainingSession): string | null {
  if (!current.expected) return null
  const expected = fromUci(current.expected)
  return current.chess.moves({ verbose: true }).find((move) => toUci(move) === toUci(expected))?.san ?? null
}

function renderOpeningResults(): void {
  const results = element<HTMLDivElement>('#opening-results')
  results.replaceChildren()
  for (const opening of searchOpenings(openings, element<HTMLInputElement>('#opening-search').value)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'opening-result'
    button.setAttribute('role', 'option')
    button.setAttribute('aria-selected', String(selectedOpening?.id === opening.id))
    const code = document.createElement('span')
    code.textContent = opening.eco
    const name = document.createElement('strong')
    name.textContent = opening.name
    button.append(code, name)
    button.addEventListener('click', () => {
      selectedOpening = opening
      session = null
      renderOpeningSelection()
      renderOpeningResults()
      render()
    })
    results.append(button)
  }
  if (!results.childElementCount && !loadError) results.textContent = openings.length ? 'No matching openings.' : 'Loading…'
}

function renderOpeningSelection(): void {
  const panel = element<HTMLDivElement>('#selected-opening')
  panel.replaceChildren()
  if (!selectedOpening) {
    panel.textContent = loadError || 'Choose an opening from the list.'
    element<HTMLButtonElement>('#start-button').disabled = true
    return
  }
  const title = document.createElement('strong')
  title.textContent = `${selectedOpening.eco} · ${selectedOpening.name}`
  const preview = document.createElement('p')
  const san = openingSan(selectedOpening)
  preview.textContent = san.slice(0, 10).map((move, index) => `${index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}${move}`).join(' ') + (san.length > 10 ? ' …' : '')
  panel.append(title, preview)
  element<HTMLButtonElement>('#start-button').disabled = false
}

function render(): void {
  const chess = session?.chess ?? previewChess
  board.update(chess, orientation, session?.playerColor ?? null, Boolean(session?.isPlayerTurn))
  element<HTMLElement>('#status').textContent = session?.completed ? 'Opening line complete' : session ? gameStatus(chess) : 'Choose an opening to begin'
  element<HTMLElement>('#turn-chip').textContent = 'Memorize lines'
  element<HTMLElement>('#board-hint').textContent = session
    ? `${Math.min(chess.history().length, session.opening.moves.length)} of ${session.opening.moves.length} line moves`
    : 'Select an opening to begin'
  const hint = session?.isPlayerTurn && element<HTMLInputElement>('#hint-toggle').checked ? expectedSan(session) : null
  element<HTMLElement>('#feedback').textContent = session?.feedback || (hint ? `Next move: ${hint}` : session ? 'Follow the line. A different move will be corrected immediately.' : loadError || 'Choose an opening to begin.')
  const moves = chess.history()
  element<HTMLElement>('#move-count').textContent = `${moves.length} ${moves.length === 1 ? 'move' : 'moves'}`
  const moveList = element<HTMLDivElement>('#move-list')
  moveList.replaceChildren()
  if (!moves.length) {
    const empty = document.createElement('p')
    empty.className = 'empty-state'
    empty.textContent = 'The board is set. Your moves will appear here.'
    moveList.append(empty)
  } else {
    for (let index = 0; index < moves.length; index += 2) {
      const row = document.createElement('div')
      row.className = 'move-row'
      for (const text of [`${index / 2 + 1}.`, moves[index], moves[index + 1] ?? '']) {
        const cell = document.createElement('span')
        cell.textContent = text
        row.append(cell)
      }
      moveList.append(row)
    }
  }
  const white = session?.playerColor === 'w' ? 'Player' : 'Computer'
  const black = session?.playerColor === 'b' ? 'Player' : 'Computer'
  element<HTMLTextAreaElement>('#pgn').value = exportPgn(chess, white, black, session?.openingReached ? { name: session.opening.name, eco: session.opening.eco } : undefined)
  element<HTMLButtonElement>('#undo-button').disabled = !session || moves.length === 0
  element<HTMLButtonElement>('#new-button').disabled = !selectedOpening
}

function startPractice(): void {
  if (!selectedOpening) return
  session = new TrainingSession(selectedOpening, 'memorize', playerColor)
  orientation = playerColor
  render()
}

element<HTMLInputElement>('#opening-search').addEventListener('input', renderOpeningResults)
element<HTMLButtonElement>('#start-button').addEventListener('click', startPractice)
element<HTMLButtonElement>('#new-button').addEventListener('click', startPractice)
element<HTMLButtonElement>('#undo-button').addEventListener('click', () => {
  session?.undoPractice()
  session?.advanceBook()
  render()
})
element<HTMLButtonElement>('#flip-button').addEventListener('click', () => {
  orientation = orientation === 'w' ? 'b' : 'w'
  render()
})
document.querySelectorAll<HTMLInputElement>('input[name="side"]').forEach((radio) => radio.addEventListener('change', () => {
  playerColor = radio.value as Color
  session = null
  orientation = playerColor
  render()
}))
element<HTMLInputElement>('#hint-toggle').addEventListener('change', render)
element<HTMLButtonElement>('#copy-button').addEventListener('click', async (event) => {
  const button = event.currentTarget as HTMLButtonElement
  const textarea = element<HTMLTextAreaElement>('#pgn')
  try {
    await navigator.clipboard.writeText(textarea.value)
    button.textContent = 'Copied!'
    window.setTimeout(() => { button.textContent = 'Copy PGN' }, 1800)
  } catch {
    textarea.focus()
    textarea.select()
  }
})

render()
loadOpenings().then((loaded) => {
  openings = loaded
  selectedOpening = openings.find((opening) => opening.name === 'Italian Game') ?? openings[0]
  renderOpeningResults()
  renderOpeningSelection()
  render()
}).catch((error: unknown) => {
  loadError = error instanceof Error ? error.message : 'Opening names could not be loaded.'
  renderOpeningSelection()
  render()
})
