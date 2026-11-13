import type { Color } from 'chess.js'
import type { Opening } from './openings'
import type { MistakeFrequency, MistakeSize } from './traps'

export type Difficulty = 'beginner' | 'intermediate' | 'strong'

export interface LinkSettings {
  requested: boolean
  openingCode: string | null
  openingName: string | null
  side: Color | null
  difficulty: Difficulty | null
  frequency: MistakeFrequency | null
  size: MistakeSize | null
  evaluation: boolean | null
}

function allowed<T extends string>(value: string | null, options: readonly T[]): T | null {
  return value && options.includes(value as T) ? value as T : null
}

export function parseLinkSettings(search: string): LinkSettings {
  const params = new URLSearchParams(search)
  const side = params.get('side')?.toLowerCase()
  const evaluation = params.get('evaluation')?.toLowerCase()
  const parsedSide = side === 'white' || side === 'w' ? 'w' : side === 'black' || side === 'b' ? 'b' : null
  const difficulty = allowed(params.get('difficulty'), ['beginner', 'intermediate', 'strong'])
  const frequency = allowed(params.get('frequency'), ['off', 'rare', 'sometimes', 'often', 'almostAlways'])
  const size = allowed(params.get('size'), ['mild', 'medium', 'large'])
  const parsedEvaluation = evaluation === 'on' || evaluation === 'true' || evaluation === '1' ? true
    : evaluation === 'off' || evaluation === 'false' || evaluation === '0' ? false : null
  return {
    requested: params.has('opening') || parsedSide !== null || difficulty !== null || frequency !== null || size !== null || parsedEvaluation !== null,
    openingCode: params.get('opening')?.trim().toUpperCase() ?? null,
    openingName: params.get('name')?.trim() ?? null,
    side: parsedSide,
    difficulty,
    frequency,
    size,
    evaluation: parsedEvaluation,
  }
}

export function resolveLinkOpening(openings: Opening[], code: string, name: string | null): Opening | null {
  if (!/^[A-E][0-9]{2}$/.test(code)) return null
  const matches = openings.filter((opening) => opening.eco === code && (!name || opening.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
  return matches.sort((a, b) => a.name.length - b.name.length || a.moves.length - b.moves.length || a.id - b.id)[0] ?? null
}

export function shareSearch(search: string, settings: {
  opening: Opening | null
  side: Color
  difficulty: Difficulty
  frequency: MistakeFrequency
  size: MistakeSize
  evaluation: boolean
}): string {
  const params = new URLSearchParams(search)
  if (settings.opening) {
    params.set('opening', settings.opening.eco)
    params.set('name', settings.opening.name)
  } else {
    params.delete('opening')
    params.delete('name')
  }
  params.set('side', settings.side === 'w' ? 'white' : 'black')
  params.set('difficulty', settings.difficulty)
  params.set('frequency', settings.frequency)
  params.set('size', settings.size)
  params.set('evaluation', settings.evaluation ? 'on' : 'off')
  return params.toString()
}
