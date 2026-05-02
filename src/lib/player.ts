import { getAccountId, getDeviceId, getSessionId } from './storage'
import { fetchState, updateProgress, transition, takeover, ConflictError } from './api'

export interface Episode {
  id: string
  title: string
  audioUrl: string
  duration: number
}

export const EPISODES: Episode[] = [
  { id: 'ep1', title: 'Introduction to Cloudflare Workers', audioUrl: '/audio/ep1.mp3', duration: 3735 },
  { id: 'ep2', title: 'Durable Objects Deep Dive', audioUrl: '/audio/ep2.mp3', duration: 3330 },
  { id: 'ep3', title: 'Building APIs with Hono', audioUrl: '/audio/ep3.mp3', duration: 2925 },
]

const SYNC_INTERVAL = 120000
const SEEK_DEBOUNCE = 5000

export class Player {
  private audio: HTMLAudioElement
  private currentEpisodeId: string | null = null
  private isPlaying = false
  private syncTimer: number | null = null
  private seekTimeout: number | null = null
  private pendingSeekSec: number | null = null
  private lastSyncedState: { positionSec: number; state: string; key: string } | null = null

  constructor(audio: HTMLAudioElement) {
    this.audio = audio

    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate())
    this.audio.addEventListener('play', () => this.onPlay())
    this.audio.addEventListener('pause', () => this.onPause())
    this.audio.addEventListener('ended', () => this.onEnded())
    this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata())

    window.addEventListener('beforeunload', () => this.syncBeforeUnload())
  }

  async init() {
    const accountId = getAccountId()
    if (!accountId) return

    try {
      const state = await fetchState(accountId)
      if (state.account?.activeEpisodeId) {
        const episode = EPISODES.find((e) => e.id === state.account!.activeEpisodeId)
        if (episode) {
          this.currentEpisodeId = episode.id
          this.audio.src = episode.audioUrl
          this.audio.currentTime = state.account.positionSec
          this.updateUI()
        }
      }
    } catch (e) {
      console.error('Failed to init player:', e)
    }
  }

  async playEpisode(episodeId: string) {
    const accountId = getAccountId()
    if (!accountId) return

    const episode = EPISODES.find((e) => e.id === episodeId)
    if (!episode) return

    const wasPlaying = this.isPlaying

    if (this.currentEpisodeId && this.currentEpisodeId !== episodeId) {
      const fromState = this.isPlaying ? 'playing' : 'paused'
      await this.transitionTo(episodeId, fromState)
      return
    }

    this.currentEpisodeId = episodeId
    this.audio.src = episode.audioUrl

    const state = await fetchState(accountId)
    const progress = state.progress[episodeId]
    if (progress) {
      this.audio.currentTime = progress.positionSec
    }

    this.updateUI()

    if (wasPlaying) {
      await this.audio.play()
    }
  }

  private async transitionTo(newEpisodeId: string, fromState: 'playing' | 'paused' | 'ended') {
    const accountId = getAccountId()
    if (!accountId) return

    const sessionId = getSessionId()
    const deviceId = getDeviceId()

    const fromEpisode = EPISODES.find((e) => e.id === this.currentEpisodeId)
    const toEpisode = EPISODES.find((e) => e.id === newEpisodeId)
    if (!fromEpisode || !toEpisode) return

    try {
      await transition({
        accountId,
        sessionId,
        deviceId,
        from: {
          episodeId: fromEpisode.id,
          positionSec: Math.floor(this.audio.currentTime),
          state: fromState,
        },
        to: {
          episodeId: toEpisode.id,
          positionSec: 0,
          state: 'playing',
        },
      })

      this.currentEpisodeId = newEpisodeId
      this.audio.src = toEpisode.audioUrl
      this.updateUI()
      await this.audio.play()
    } catch (e) {
      if ((e as ConflictError).error === 'conflict') {
        this.showConflictModal((e as ConflictError).activeDeviceId)
      }
    }
  }

  private showConflictModal(activeDeviceId: string) {
    const modal = document.getElementById('conflict-modal')
    const deviceEl = document.getElementById('conflict-device')
    if (modal && deviceEl) {
      deviceEl.textContent = `Device: ${activeDeviceId.slice(0, 8)}...`
      modal.classList.remove('hidden')
    }
  }

  async handleTakeover() {
    const accountId = getAccountId()
    if (!accountId || !this.currentEpisodeId) return

    const sessionId = getSessionId()
    const deviceId = getDeviceId()

    await takeover({
      accountId,
      sessionId,
      deviceId,
      episodeId: this.currentEpisodeId,
      positionSec: Math.floor(this.audio.currentTime),
      state: this.isPlaying ? 'playing' : 'paused',
    })

    document.getElementById('conflict-modal')?.classList.add('hidden')
  }

  toggle() {
    if (this.isPlaying) {
      this.audio.pause()
    } else {
      this.audio.play()
    }
  }

  seek(percent: number) {
    const time = (percent / 100) * this.audio.duration
    this.audio.currentTime = time

    if (this.seekTimeout) clearTimeout(this.seekTimeout)
    this.seekTimeout = window.setTimeout(() => {
      this.syncProgress()
    }, SEEK_DEBOUNCE)
  }

  private onTimeUpdate() {
    const positionSec = Math.floor(this.audio.currentTime)
    const durationSec = Math.floor(this.audio.duration || 0)

    document.getElementById('current-time')!.textContent = this.formatTime(positionSec)
    document.getElementById('duration')!.textContent = this.formatTime(durationSec)

    const slider = document.getElementById('progress-slider') as HTMLInputElement
    if (this.audio.duration) {
      slider.value = String((this.audio.currentTime / this.audio.duration) * 100)
    }
  }

  private onPlay() {
    this.isPlaying = true
    this.updatePlayButton()
    this.startSyncTimer()
    this.syncProgress()
  }

  private onPause() {
    this.isPlaying = false
    this.updatePlayButton()
    this.stopSyncTimer()
    this.syncProgress()
  }

  private async onEnded() {
    this.isPlaying = false
    this.updatePlayButton()
    this.syncProgress('ended')
  }

  private onLoadedMetadata() {
    this.updateUI()
  }

  private startSyncTimer() {
    this.stopSyncTimer()
    this.syncTimer = window.setInterval(() => {
      this.syncProgress()
    }, SYNC_INTERVAL)
  }

  private stopSyncTimer() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  private async syncProgress(stateOverride?: 'playing' | 'paused' | 'ended') {
    const accountId = getAccountId()
    if (!accountId || !this.currentEpisodeId) return

    const sessionId = getSessionId()
    const deviceId = getDeviceId()
    const positionSec = Math.floor(this.audio.currentTime)
    const state = stateOverride || (this.isPlaying ? 'playing' : 'paused')

    const key = `${positionSec}-${state}`
    if (this.lastSyncedState && this.lastSyncedState.key === key) return

    try {
      this.setSyncStatus('syncing')
      await updateProgress({
        accountId,
        sessionId,
        deviceId,
        episodeId: this.currentEpisodeId,
        positionSec,
        durationSec: Math.floor(this.audio.duration),
        state,
      })
      this.lastSyncedState = { positionSec, state, key }
      this.setSyncStatus('synced')
    } catch (e) {
      if ((e as ConflictError).error === 'conflict') {
        this.showConflictModal((e as ConflictError).activeDeviceId)
        this.setSyncStatus('error')
      }
    }
  }

  private async syncBeforeUnload() {
    const accountId = getAccountId()
    if (!accountId || !this.currentEpisodeId) return

    const sessionId = getSessionId()
    const deviceId = getDeviceId()
    const positionSec = Math.floor(this.audio.currentTime)
    const state = this.isPlaying ? 'playing' : 'paused'

    const body = JSON.stringify({
      accountId,
      sessionId,
      deviceId,
      episodeId: this.currentEpisodeId,
      positionSec,
      state,
    })

    navigator.sendBeacon('/api/progress', body)
  }

  private updateUI() {
    if (!this.currentEpisodeId) return

    const episode = EPISODES.find((e) => e.id === this.currentEpisodeId)
    if (!episode) return

    document.getElementById('now-playing-title')!.textContent = episode.title
    document.getElementById('now-playing-episode')!.textContent = `Episode ${episode.id.replace('ep', '')}`

    document.querySelectorAll('.episode-item').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-episode') === this.currentEpisodeId)
    })

    this.updatePlayButton()
  }

  private updatePlayButton() {
    const playIcon = document.querySelector('.play-icon') as HTMLElement
    const pauseIcon = document.querySelector('.pause-icon') as HTMLElement

    if (this.isPlaying) {
      playIcon?.classList.add('hidden')
      pauseIcon?.classList.remove('hidden')
    } else {
      playIcon?.classList.remove('hidden')
      pauseIcon?.classList.add('hidden')
    }
  }

  private setSyncStatus(status: 'synced' | 'syncing' | 'error') {
    const indicator = document.getElementById('sync-indicator')
    const text = document.getElementById('sync-text')

    if (indicator) {
      indicator.className = 'sync-indicator'
      if (status === 'syncing') indicator.classList.add('syncing')
      if (status === 'error') indicator.classList.add('error')
    }

    if (text) {
      text.textContent = status === 'syncing' ? 'Syncing...' : status === 'error' ? 'Sync Error' : 'Synced'
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  getCurrentEpisodeId(): string | null {
    return this.currentEpisodeId
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }
}