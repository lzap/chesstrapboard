import { Chess, type Color } from 'chess.js'
import { BoardView } from './board'
import { exportPgn, gameStatus } from './chess'
import { EngineClient } from './engine'
import { fromUci, loadOpenings, openingSan, searchOpenings, toUci, type Opening } from './openings'
import { TrainingSession, type Mode } from './session'
import './style.css'

const element = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!
const previewChess = new Chess()
let openings: Opening[] = []
let selectedOpening: Opening | null = null
let session: TrainingSession | null = null
let playerColor: Color = 'w'
let orientation: Color = 'w'
let loadError = ''
let mode: Mode = 'memorize'
let thinking = false
let engineError = false
let generation = 0
const engine = new EngineClient()

const board = new BoardView(element('#board-container'), (input) => {
  if (!session) return
  const move = session.playPlayer(input)
  render()
  if (move && mode === 'traps') void runCpu()
})

function invalidateGame(): void {
  generation += 1
  engine.stop()
  thinking = false
  engineError = false
}

function difficultyBudget(): number {
  const difficulty = element<HTMLSelectElement>('#difficulty').value
  return difficulty === 'beginner' ? 180 : difficulty === 'strong' ? 1300 : 550
}

async function runCpu(): Promise<void> {
  const current = session
  if (!current || current.mode !== 'traps' || !current.isCpuTurn) return
  if (current.advanceBook()) {
    render()
    return
  }
  const token = generation
  thinking = true
  engineError = false
  render()
  try {
    const result = await engine.search(current.chess.fen(), difficultyBudget())
    if (token !== generation || current !== session) return
    thinking = false
    if (!result.bestMove || !current.playCpu(fromUci(result.bestMove))) throw new Error('Engine did not return a legal move')
    render()
  } catch (error) {
    if (token !== generation || current !== session) return
    thinking = false
    engineError = true
    engine.terminate()
    current.feedback = error instanceof Error ? error.message : 'Engine failed to move'
    render()
  }
}

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
      invalidateGame()
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
  const hasPlayerMove = selectedOpening.moves.some((_, index) => index % 2 === (playerColor === 'w' ? 0 : 1))
  if (mode === 'memorize' && !hasPlayerMove) {
    const note = document.createElement('p')
    note.textContent = 'Choose a longer variation to practice this color.'
    panel.append(note)
  }
  element<HTMLButtonElement>('#start-button').disabled = mode === 'memorize' && !hasPlayerMove
}

function renderModeControls(): void {
  for (const [name, id] of [['memorize', '#memorize-mode'], ['traps', '#traps-mode']] as const) {
    const button = element<HTMLButtonElement>(id)
    button.classList.toggle('active', mode === name)
    button.setAttribute('aria-pressed', String(mode === name))
  }
  element<HTMLLabelElement>('#hint-option').hidden = mode !== 'memorize'
  element<HTMLDivElement>('#trap-controls').hidden = mode !== 'traps'
  element<HTMLButtonElement>('#undo-button').hidden = mode !== 'memorize'
  element<HTMLButtonElement>('#finish-button').hidden = mode !== 'traps'
  element<HTMLButtonElement>('#new-button').textContent = mode === 'memorize' ? 'Restart line' : 'New game'
  element<HTMLButtonElement>('#start-button').textContent = mode === 'memorize' ? 'Start practice' : 'Start game'
}

function render(): void {
  renderModeControls()
  const chess = session?.chess ?? previewChess
  board.update(chess, orientation, session?.playerColor ?? null, Boolean(session?.isPlayerTurn) && !thinking)
  element<HTMLElement>('#status').textContent = session?.completed
    ? session.mode === 'memorize' ? 'Opening line complete' : session.finishReason ? 'Game ended' : gameStatus(chess)
    : thinking ? 'Computer is thinking…' : session ? gameStatus(chess) : 'Choose an opening to begin'
  element<HTMLElement>('#turn-chip').textContent = mode === 'memorize' ? 'Memorize lines' : 'Explore traps'
  element<HTMLElement>('#board-hint').textContent = session
    ? session.mode === 'memorize'
      ? `${Math.min(chess.history().length, session.opening.moves.length)} of ${session.opening.moves.length} line moves`
      : session.openingReached ? 'Opening reached · full game' : session.bookActive ? 'Following opening' : 'Full game'
    : 'Select an opening to begin'
  const hint = mode === 'memorize' && session?.isPlayerTurn && element<HTMLInputElement>('#hint-toggle').checked ? expectedSan(session) : null
  element<HTMLElement>('#feedback').textContent = session?.feedback || (hint ? `Next move: ${hint}` : thinking ? 'The engine is choosing a move. Its files are hosted by this site.' : session ? mode === 'memorize' ? 'Follow the line. A different move will be corrected immediately.' : 'Play the whole game. Review comes after it ends.' : loadError || 'Choose an opening to begin.')
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
  const resultOverride = session?.finishReason === 'resigned' ? (session.playerColor === 'w' ? '0-1' : '1-0') : undefined
  element<HTMLTextAreaElement>('#pgn').value = exportPgn(chess, white, black, session?.openingReached ? { name: session.opening.name, eco: session.opening.eco } : undefined, resultOverride)
  element<HTMLButtonElement>('#undo-button').disabled = !session || moves.length === 0
  element<HTMLButtonElement>('#finish-button').disabled = !session || session.completed
  element<HTMLButtonElement>('#retry-cpu-button').hidden = !engineError || !session?.isCpuTurn
  element<HTMLButtonElement>('#new-button').disabled = !selectedOpening
}

function startPractice(): void {
  if (!selectedOpening) return
  invalidateGame()
  session = new TrainingSession(selectedOpening, mode, playerColor)
  orientation = playerColor
  render()
  if (mode === 'traps') void runCpu()
}

element<HTMLInputElement>('#opening-search').addEventListener('input', renderOpeningResults)
for (const [name, id] of [['memorize', '#memorize-mode'], ['traps', '#traps-mode']] as const) {
  element<HTMLButtonElement>(id).addEventListener('click', () => {
    if (mode === name) return
    invalidateGame()
    mode = name
    session = null
    renderOpeningSelection()
    render()
  })
}
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
element<HTMLButtonElement>('#finish-button').addEventListener('click', () => {
  invalidateGame()
  session?.finish('stopped')
  render()
})
element<HTMLButtonElement>('#retry-cpu-button').addEventListener('click', () => void runCpu())
document.querySelectorAll<HTMLInputElement>('input[name="side"]').forEach((radio) => radio.addEventListener('change', () => {
  invalidateGame()
  playerColor = radio.value as Color
  session = null
  orientation = playerColor
  renderOpeningSelection()
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
