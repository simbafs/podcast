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
  getOrder,
  setOrder,
} from './lib/storage'
import { fetchState, generateUUID, saveFeedUrl } from './lib/api'
import { Player } from './lib/player'
import { parseFeed } from './lib/rss'

let player: Player
let accountId: string

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
  let episodes = [...getEpisodes()]

  const order = getOrder()
  if (order === 'new-to-old') {
    episodes.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0))
  } else {
    episodes.sort((a, b) => (a.pubDate || 0) - (b.pubDate || 0))
  }

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

function updateUiState(hasEpisodes: boolean) {
  const main = document.querySelector('.main')
  if (hasEpisodes) {
    main?.classList.add('has-episodes')
  } else {
    main?.classList.remove('has-episodes')
  }
}

async function loadFeed(url: string, currentAccountId: string) {
  const statusEl = document.getElementById('feed-status')

  statusEl!.textContent = 'Fetching feed...'

  try {
    const feed = await parseFeed(url)
    setRssUrl(url)
    setEpisodes(feed.episodes)
    setLastFetchedAt(Date.now())

    await saveFeedUrl(currentAccountId, url)

    statusEl!.textContent = `Loaded ${feed.episodes.length} episodes from "${feed.title}"`
    updateUiState(true)
    renderEpisodes()
  } catch (e) {
    statusEl!.textContent = `Error: ${e instanceof Error ? e.message : 'Failed to parse feed'}`
  }
}

async function initApp() {
  accountId = getAccountId() || generateUUID()
  setAccountId(accountId)

  const currentAccountId = getAccountId()
  const currentDeviceId = getDeviceId()
  document.getElementById('device-badge')!.textContent = 
    `${currentAccountId?.slice(0, 6)} (${currentDeviceId.slice(0, 6)})`
  initTheme()

  const feedInput = document.getElementById('rss-url') as HTMLInputElement
  const fetchBtn = document.getElementById('fetch-feed-btn')
  const statusEl = document.getElementById('feed-status')

  const settingsDialog = document.getElementById('settings-dialog') as HTMLDialogElement
  const settingsRssInput = document.getElementById('settings-rss-url') as HTMLInputElement

  fetchBtn?.addEventListener('click', async () => {
    const url = feedInput.value.trim()
    if (!url) {
      statusEl!.textContent = 'Please enter a feed URL'
      return
    }
    await loadFeed(url, accountId)
  })

  document.getElementById('refetch-btn')?.addEventListener('click', async () => {
    const currentUrl = getRssUrl()
    if (currentUrl) {
      await loadFeed(currentUrl, accountId)
    }
  })

  document.getElementById('reverse-btn')?.addEventListener('click', async () => {
    const currentOrder = getOrder()
    const newOrder = currentOrder === 'new-to-old' ? 'old-to-new' : 'new-to-old'
    setOrder(newOrder)
    try {
      await saveFeedUrl(accountId, getRssUrl() || '', newOrder)
    } catch (e) {
      console.error('Failed to sync order:', e)
    }
    renderEpisodes()
  })

  document.getElementById('episode-reverse-btn')?.addEventListener('click', async () => {
    const currentOrder = getOrder()
    const newOrder = currentOrder === 'new-to-old' ? 'old-to-new' : 'new-to-old'
    setOrder(newOrder)
    try {
      await saveFeedUrl(accountId, getRssUrl() || '', newOrder)
    } catch (e) {
      console.error('Failed to sync order:', e)
    }
    renderEpisodes()
  })

  document.getElementById('clear-btn')?.addEventListener('click', async () => {
    setEpisodes([])
    setRssUrl('')
    setLastFetchedAt(0)
    setOrder('old-to-new')

    try {
      await saveFeedUrl(accountId, '', 'old-to-new')
    } catch (e) {
      console.error('Failed to clear feed URL:', e)
    }

    updateUiState(false)
    renderEpisodes()
    feedInput.value = ''
  })

  document.getElementById('settings-btn')?.addEventListener('click', () => {
    settingsRssInput.value = getRssUrl() || ''
    settingsDialog.showModal()
  })

  document.getElementById('settings-close')?.addEventListener('click', () => {
    settingsDialog.close()
  })

  settingsDialog.addEventListener('submit', async (e) => {
    e.preventDefault()
    const url = settingsRssInput.value.trim()
    if (url) {
      feedInput.value = url
      await loadFeed(url, accountId)
      settingsDialog.close()
    }
  })

  document.getElementById('share-btn')?.addEventListener('click', () => {
    const link = generateShareLink(accountId)
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

    let episodes = [...getEpisodes()]
    const order = getOrder()
    if (order === 'new-to-old') {
      episodes.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0))
    } else {
      episodes.sort((a, b) => (a.pubDate || 0) - (b.pubDate || 0))
    }
    const idx = episodes.findIndex((e) => e.id === currentId)
    if (idx > 0) {
      player?.playEpisode(episodes[idx - 1].id)
    }
  })

  document.getElementById('next-btn')?.addEventListener('click', () => {
    const currentId = player?.getCurrentEpisodeId()
    if (!currentId) return

    let episodes = [...getEpisodes()]
    const order = getOrder()
    if (order === 'new-to-old') {
      episodes.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0))
    } else {
      episodes.sort((a, b) => (a.pubDate || 0) - (b.pubDate || 0))
    }
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
    const serverOrder = state.account?.order || 'old-to-new'
    setOrder(serverOrder)

    if (serverRssUrl) {
      setRssUrl(serverRssUrl)
      feedInput.value = serverRssUrl
      updateUiState(true)

      if (shouldRefetch() || getEpisodes().length === 0) {
        await loadFeed(serverRssUrl, accountId)
      } else {
        renderEpisodes()
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