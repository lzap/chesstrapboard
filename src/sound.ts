import type { Chess } from 'chess.js'

/** Optional sounds synthesized locally with Web Audio. No audio files are loaded. */
export class GameSounds {
  moveEnabled = true
  opportunityEnabled = true
  volume = 0.5
  private context: AudioContext | null = null

  /** Call from a user gesture so an opportunity chime can play after the engine thinks. */
  activate(): void {
    if ((!this.moveEnabled && !this.opportunityEnabled) || this.volume <= 0) return
    try { this.audioContext() } catch { /* Audio is optional. */ }
  }

  playAfterMove(chess: Chess, opportunity = false): void {
    if (chess.isCheckmate() || chess.isStalemate()) {
      this.playOpportunity()
      return
    }
    this.playMove()
    if (opportunity) this.playOpportunity(this.moveEnabled ? 0.17 : 0)
  }

  playMove(): void {
    if (!this.moveEnabled || this.volume <= 0) return
    try {
      const context = this.audioContext()
      const start = context.currentTime
      const duration = 0.09
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
      const samples = buffer.getChannelData(0)
      for (let index = 0; index < samples.length; index += 1) {
        const seconds = index / context.sampleRate
        const attack = Math.min(1, seconds / 0.004)
        samples[index] = (Math.random() * 2 - 1) * attack * Math.exp(-seconds * 42)
      }
      const noise = context.createBufferSource()
      noise.buffer = buffer
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 650
      const noiseGain = context.createGain()
      noiseGain.gain.value = this.volume * 0.075
      noise.connect(filter).connect(noiseGain).connect(context.destination)
      noise.start(start)
      noise.stop(start + duration)

      const tap = context.createOscillator()
      tap.type = 'triangle'
      tap.frequency.setValueAtTime(185, start)
      tap.frequency.exponentialRampToValueAtTime(125, start + 0.1)
      const tapGain = context.createGain()
      tapGain.gain.setValueAtTime(0.001, start)
      tapGain.gain.linearRampToValueAtTime(Math.max(0.0015, this.volume * 0.16), start + 0.008)
      tapGain.gain.exponentialRampToValueAtTime(0.001, start + 0.12)
      tap.connect(tapGain).connect(context.destination)
      tap.start(start)
      tap.stop(start + 0.13)
    } catch { /* Unavailable devices and blocked playback stay silent. */ }
  }

  playOpportunity(delay = 0): void {
    if (!this.opportunityEnabled || this.volume <= 0) return
    try {
      const context = this.audioContext()
      for (const [index, frequency] of [523.25, 659.25].entries()) {
        const start = context.currentTime + delay + index * 0.12
        const note = context.createOscillator()
        note.type = 'sine'
        note.frequency.value = frequency
        const gain = context.createGain()
        gain.gain.setValueAtTime(0.001, start)
        gain.gain.linearRampToValueAtTime(Math.max(0.0015, this.volume * 0.13), start + 0.025)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
        note.connect(gain).connect(context.destination)
        note.start(start)
        note.stop(start + 0.23)
      }
    } catch { /* Audio is optional. */ }
  }

  private audioContext(): AudioContext {
    this.context ??= new AudioContext()
    if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined)
    return this.context
  }
}
