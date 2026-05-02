import { getAccountId, getDeviceId, setAccountId, clearAccount, getSessionId } from './lib/storage'
import { fetchState, generateUUID } from './lib/api'
import { Player, getEpisodes, addEpisode, Episode } from './lib/player'

let player: Player

function generateShareLink(accountId: string): string {
  const url = new URL(window.location.href)
  url.searchParams.set('account', accountId)
  return url.toString()
}

async function initApp() {
  const accountId = getAccountId()
  const deviceId = getDeviceId()
  const urlParams = new URLSearchParams(window.location.search)
  const urlAccountId = urlParams.get('account')

  document.getElementById('device-badge')!.textContent = `Device: ${deviceId.slice(0, 8)}`

  if (urlAccountId && urlAccountId !== accountId) {
    setAccountId(urlAccountId)
    window.history.replaceState({}, '', window.location.pathname)
  }

  const currentAccountId = getAccountId()

  if (currentAccountId) {
    showAccountInfo(currentAccountId)
    await initPlayer(currentAccountId)
  } else {
    showNoAccount()
  }

  document.getElementById('create-account-btn')?.addEventListener('click', async () => {
    const newAccountId = generateUUID()
    setAccountId(newAccountId)
    showAccountInfo(newAccountId)
    await initPlayer(newAccountId)
  })

  document.getElementById('share-btn')?.addEventListener('click', () => {
    const accountId = getAccountId()
    if (accountId) {
      const link = generateShareLink(accountId)
      navigator.clipboard.writeText(link).then(() => {
        const btn = document.getElementById('share-btn')
        if (btn) {
          const origText = btn.textContent
          btn.textContent = 'Copied!'
          setTimeout(() => (btn.textContent = origText), 2000)
        }
      })
    }
  })

  document.getElementById('play-btn')?.addEventListener('click', () => {
    player?.toggle()
  })

  document.getElementById('prev-btn')?.addEventListener('click', () => {
    const currentId = player?.getCurrentEpisodeId()
    if (!currentId) return

    const idx = EPISODES.findIndex((e) => e.id === currentId)
    if (idx > 0) {
      player?.playEpisode(EPISODES[idx - 1].id)
    }
  })

  document.getElementById('next-btn')?.addEventListener('click', () => {
    const currentId = player?.getCurrentEpisodeId()
    if (!currentId) return

    const idx = EPISODES.findIndex((e) => e.id === currentId)
    if (idx < EPISODES.length - 1) {
      player?.playEpisode(EPISODES[idx + 1].id)
    }
  })

  document.querySelectorAll('.episode-item').forEach((el) => {
    el.addEventListener('click', () => {
      const episodeId = el.getAttribute('data-episode')
      if (episodeId) {
        player?.playEpisode(episodeId)
      }
    })
  })

  document.getElementById('progress-slider')?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value)
    player?.seek(value)
  })

  document.getElementById('cancel-conflict')?.addEventListener('click', () => {
    document.getElementById('conflict-modal')?.classList.add('hidden')
  })

  document.getElementById('takeover-btn')?.addEventListener('click', () => {
    player?.handleTakeover()
  })
}

function showAccountInfo(accountId: string) {
  document.getElementById('account-info')?.classList.remove('hidden')
  document.getElementById('no-account')?.classList.add('hidden')
  document.getElementById('account-id-display')!.textContent = accountId
  document.getElementById('device-id-display')!.textContent = getDeviceId()
}

function showNoAccount() {
  document.getElementById('account-info')?.classList.add('hidden')
  document.getElementById('no-account')?.classList.remove('hidden')
}

function renderEpisodes() {
  const list = document.getElementById('episode-list')
  if (!list) return

  list.innerHTML = ''
  const episodes = getEpisodes()

  if (episodes.length === 0) {
    list.innerHTML = '<p class="no-episodes">No episodes yet. Add one above!</p>'
    return
  }

  episodes.forEach((ep, idx) => {
    const div = document.createElement('div')
    div.className = 'episode-item'
    div.setAttribute('data-episode', ep.id)
    div.innerHTML = `
      <div class="episode-info">
        <span class="episode-number">${String(idx + 1).padStart(2, '0')}</span>
        <span class="episode-title">${ep.title}</span>
      </div>
      <div class="episode-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
        <span class="time">00:00 / ${formatDuration(ep.duration)}</span>
      </div>
    `
    div.addEventListener('click', () => {
      player?.playEpisode(ep.id)
    })
    list.appendChild(div)
  })
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function initAddEpisodeForm() {
  const btn = document.getElementById('add-episode-btn')
  btn?.addEventListener('click', () => {
    const titleInput = document.getElementById('episode-title') as HTMLInputElement
    const urlInput = document.getElementById('episode-url') as HTMLInputElement
    const durationInput = document.getElementById('episode-duration') as HTMLInputElement

    const title = titleInput.value.trim()
    const url = urlInput.value.trim()
    const duration = parseInt(durationInput.value, 10)

    if (!title || !url || isNaN(duration)) {
      alert('Please fill in all fields')
      return
    }

    const episode: Episode = {
      id: generateUUID(),
      title,
      audioUrl: url,
      duration,
    }

    addEpisode(episode)
    renderEpisodes()

    titleInput.value = ''
    urlInput.value = ''
    durationInput.value = ''
  })
}

async function initPlayer(accountId: string) {
  const audio = document.getElementById('audio-player') as HTMLAudioElement
  player = new Player(audio)
  await player.init()
  renderEpisodes()
}

document.addEventListener('DOMContentLoaded', initApp)