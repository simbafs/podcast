import {
  getAccountId,
  getDeviceId,
  setAccountId,
  getRssUrl,
  setRssUrl,
  getLastFetchedAt,
  setLastFetchedAt,
  getEpisodes,
  setEpisodes,
  shouldRefetch,
} from './lib/storage'
import { fetchState, generateUUID, Episode, saveFeedUrl } from './lib/api'
import { Player } from './lib/player'
import { parseFeed } from './lib/rss'

let player: Player

type Theme = 'dark' | 'light' | 'system'
const THEME_KEY = 'podcast-theme'

function getStoredTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme) || 'dark'
}

function applyTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme)
  const root = document.documentElement
  const iconDark = document.getElementById('theme-icon-dark')
  const iconLight = document.getElementById('theme-icon-light')
  const iconSystem = document.getElementById('theme-icon-system')

  iconDark?.classList.add('hidden')
  iconLight?.classList.add('hidden')
  iconSystem?.classList.add('hidden')

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    iconSystem?.classList.remove('hidden')
  } else {
    root.setAttribute('data-theme', theme)
    if (theme === 'light') {
      iconLight?.classList.remove('hidden')
    } else {
      iconDark?.classList.remove('hidden')
    }
  }
}

function cycleTheme() {
  const current = getStoredTheme()
  const order: Theme[] = ['dark', 'light', 'system']
  const idx = order.indexOf(current)
  const next = order[(idx + 1) % order.length]
  applyTheme(next)
}

function initTheme() {
  applyTheme(getStoredTheme())
  document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system')
    }
  })
}

function generateShareLink(accountId: string): string {
  const url = new URL(window.location.href)
  url.searchParams.set('account', accountId)
  return url.toString()
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function renderEpisodes() {
  const list = document.getElementById('episode-list')
  if (!list) return

  list.innerHTML = ''
  const episodes = getEpisodes()

  if (episodes.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:2rem">No episodes. Enter an RSS feed URL above.</p>'
    return
  }

  episodes.forEach((ep) => {
    const div = document.createElement('div')
    div.className = 'episode-item'
    div.setAttribute('data-episode', ep.id)
    div.innerHTML = `
      <div class="episode-info">
        <span class="episode-title">${ep.title}</span>
      </div>
      <span class="episode-duration">${formatDuration(ep.duration)}</span>
    `
    div.addEventListener('click', () => {
      player?.playEpisode(ep.id)
    })
    list.appendChild(div)
  })
}

async function loadFeed(url: string, accountId: string) {
  const statusEl = document.getElementById('feed-status')
  const refetchBtn = document.getElementById('refetch-btn')

  statusEl!.textContent = 'Fetching feed...'

  try {
    const feed = await parseFeed(url)
    setRssUrl(url)
    setEpisodes(feed.episodes)
    setLastFetchedAt(Date.now())

    await saveFeedUrl(accountId, url)

    statusEl!.textContent = `Loaded ${feed.episodes.length} episodes from "${feed.title}"`
    refetchBtn?.classList.remove('hidden')
    renderEpisodes()
  } catch (e) {
    statusEl!.textContent = `Error: ${e instanceof Error ? e.message : 'Failed to parse feed'}`
  }
}

async function initApp() {
  let accountId = getAccountId()

  if (!accountId) {
    accountId = generateUUID()
    setAccountId(accountId)
  }

  document.getElementById('device-badge')!.textContent = `Device: ${getDeviceId().slice(0, 8)}`
  initTheme()

  const feedInput = document.getElementById('rss-url') as HTMLInputElement
  const fetchBtn = document.getElementById('fetch-feed-btn')
  const refetchBtn = document.getElementById('refetch-btn')
  const statusEl = document.getElementById('feed-status')

  fetchBtn?.addEventListener('click', async () => {
    const url = feedInput.value.trim()
    if (!url) {
      statusEl!.textContent = 'Please enter a feed URL'
      return
    }
    await loadFeed(url, accountId!)
  })

  refetchBtn?.addEventListener('click', async () => {
    const currentUrl = getRssUrl()
    if (currentUrl) {
      await loadFeed(currentUrl, accountId!)
    }
  })

  document.getElementById('share-btn')?.addEventListener('click', () => {
    const link = generateShareLink(accountId!)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        const btn = document.getElementById('share-btn')
        if (btn) {
          const origText = btn.innerHTML
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
          setTimeout(() => (btn.innerHTML = origText), 2000)
        }
      })
    } else {
      const textArea = document.createElement('textarea')
      textArea.value = link
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        const btn = document.getElementById('share-btn')
        if (btn) {
          const origText = btn.innerHTML
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
          setTimeout(() => (btn.innerHTML = origText), 2000)
        }
      } catch {
        alert(`Share link: ${link}`)
      }
      document.body.removeChild(textArea)
    }
  })

  document.getElementById('play-btn')?.addEventListener('click', () => {
    player?.toggle()
  })

  document.getElementById('prev-btn')?.addEventListener('click', () => {
    const currentId = player?.getCurrentEpisodeId()
    if (!currentId) return

    const episodes = getEpisodes()
    const idx = episodes.findIndex((e) => e.id === currentId)
    if (idx > 0) {
      player?.playEpisode(episodes[idx - 1].id)
    }
  })

  document.getElementById('next-btn')?.addEventListener('click', () => {
    const currentId = player?.getCurrentEpisodeId()
    if (!currentId) return

    const episodes = getEpisodes()
    const idx = episodes.findIndex((e) => e.id === currentId)
    if (idx < episodes.length - 1) {
      player?.playEpisode(episodes[idx + 1].id)
    }
  })

  document.getElementById('progress-slider')?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value)
    player?.seek(value)
  })

  try {
    const state = await fetchState(accountId)
    const serverRssUrl = state.account?.rssUrl || null

    if (serverRssUrl) {
      setRssUrl(serverRssUrl)
      feedInput.value = serverRssUrl
      refetchBtn?.classList.remove('hidden')

      if (shouldRefetch()) {
        await loadFeed(serverRssUrl, accountId)
      } else {
        const localEpisodes = getEpisodes()
        if (localEpisodes.length === 0) {
          await loadFeed(serverRssUrl, accountId)
        } else {
          renderEpisodes()
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch state:', e)
  }

  await initPlayer(accountId)
}

async function initPlayer(accountId: string) {
  const audio = document.getElementById('audio-player') as HTMLAudioElement
  player = new Player(audio, accountId)
  await player.init()
  renderEpisodes()

  const currentEpisodeId = player.getCurrentEpisodeId()
  if (currentEpisodeId) {
    setTimeout(() => {
      const activeEl = document.querySelector('.episode-item.active')
      activeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }
}

document.addEventListener('DOMContentLoaded', initApp)