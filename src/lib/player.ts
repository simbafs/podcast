import { getDeviceId, getSessionId, getEpisodes } from './storage'
import { fetchState, updateProgress, ConflictError, Episode } from './api'

const SYNC_INTERVAL = 120000
const SEEK_DEBOUNCE = 5000

export class Player {
  private audio: HTMLAudioElement
  private accountId: string
  private currentEpisodeId: string | null = null
  private isPlaying = false
  private syncTimer: number | null = null
  private seekTimeout: number | null = null
  private lastSyncedState: { positionSec: number; state: string; key: string } | null = null

  constructor(audio: HTMLAudioElement, accountId: string) {
    this.audio = audio
    this.accountId = accountId

    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate())
    this.audio.addEventListener('play', () => this.onPlay())
    this.audio.addEventListener('pause', () => this.onPause())
    this.audio.addEventListener('ended', () => this.onEnded())
    this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata())

    window.addEventListener('beforeunload', () => this.syncBeforeUnload())
  }

  async init() {
    try {
      const state = await fetchState(this.accountId)
      if (state.account?.activeEpisodeId) {
        const episodes = getEpisodes()
        const episode = episodes.find((e) => e.id === state.account!.activeEpisodeId)
        if (episode) {
          this.currentEpisodeId = episode.id
          this.audio.src = episode.audioUrl
          this.audio.currentTime = state.account.activePositionSec || 0
          this.updateUI()
        }
      }
    } catch (e) {
      console.error('Failed to init player:', e)
    }
  }

  async playEpisode(episodeId: string) {
    const episodes = getEpisodes()
    const episode = episodes.find((e) => e.id === episodeId)
    if (!episode) return

    const wasPlaying = this.isPlaying
    const fromEpisodeId = this.currentEpisodeId
    const fromPositionSec = Math.floor(this.audio.currentTime)
    const fromState = this.isPlaying ? 'playing' : 'paused'

    this.currentEpisodeId = episodeId
    this.audio.src = episode.audioUrl

    try {
      const state = await fetchState(this.accountId)
      if (state.progress[episodeId]) {
        this.audio.currentTime = state.progress[episodeId].positionSec
      }
    } catch (e) {
      console.error('Failed to fetch progress:', e)
    }

    this.updateUI()

    if (fromEpisodeId && fromEpisodeId !== episodeId) {
      try {
        await updateProgress({
          accountId: this.accountId,
          sessionId: getSessionId(),
          deviceId: getDeviceId(),
          episodeId: fromEpisodeId,
          positionSec: fromPositionSec,
          state: fromState,
        })
      } catch (e) {
        console.error('Failed to save previous progress:', e)
      }
    }

    if (wasPlaying) {
      await this.audio.play()
    }
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
    if (!this.currentEpisodeId) return

    const sessionId = getSessionId()
    const deviceId = getDeviceId()
    const positionSec = Math.floor(this.audio.currentTime)
    const state = stateOverride || (this.isPlaying ? 'playing' : 'paused')

    const key = `${positionSec}-${state}`
    if (this.lastSyncedState && this.lastSyncedState.key === key) return

    try {
      this.setSyncStatus('syncing')
      await updateProgress({
        accountId: this.accountId,
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
        this.setSyncStatus('synced')
      }
    }
  }

  private async syncBeforeUnload() {
    if (!this.currentEpisodeId) return

    const sessionId = getSessionId()
    const deviceId = getDeviceId()
    const positionSec = Math.floor(this.audio.currentTime)
    const state = this.isPlaying ? 'playing' : 'paused'

    const body = JSON.stringify({
      accountId: this.accountId,
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

    const episodes = getEpisodes()
    const episode = episodes.find((e) => e.id === this.currentEpisodeId)
    if (!episode) return

    document.getElementById('now-playing-title')!.textContent = episode.title

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