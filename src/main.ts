import { getAccountId, getDeviceId, setAccountId, clearAccount, getSessionId } from './lib/storage'
import { fetchState, generateUUID, Episode, addEpisodes as addEpisodesApi } from './lib/api'
import { Player, getEpisodes, addEpisode, loadEpisodes, setEpisodes } from './lib/player'
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

async function initApp() {
  const accountId = getAccountId()
  const deviceId = getDeviceId()
  const urlParams = new URLSearchParams(window.location.search)
  const urlAccountId = urlParams.get('account')

  document.getElementById('device-badge')!.textContent = `Device: ${deviceId.slice(0, 8)}`
  initTheme()

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

  initSidebar()

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
    list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:2rem">No episodes yet</p>'
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

let feedPreviewEpisodes: Episode[] = []
let selectedFeedPosition: 'head' | 'tail' = 'tail'
let selectedFeedOrder: 'asc' | 'desc' = 'asc'
let selectedSinglePosition: 'head' | 'tail' = 'tail'

function initSidebar() {
  const addBtn = document.getElementById('add-btn')
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebar-overlay')
  const closeBtn = document.getElementById('sidebar-close')
  const tabSingle = document.getElementById('sidebar-tab-single')
  const tabFeed = document.getElementById('sidebar-tab-feed')
  const singleContent = document.getElementById('sidebar-single')
  const feedContent = document.getElementById('sidebar-feed')

  function openSidebar() {
    sidebar?.classList.add('open')
    overlay?.classList.remove('hidden')
    overlay?.classList.add('open')
    document.body.style.overflow = 'hidden'
    document.querySelector('main')?.setAttribute('inert', '')
    document.querySelector('header')?.setAttribute('inert', '')
  }

  function closeSidebar() {
    sidebar?.classList.remove('open')
    overlay?.classList.add('hidden')
    overlay?.classList.remove('open')
    document.body.style.overflow = ''
    document.querySelector('main')?.removeAttribute('inert')
    document.querySelector('header')?.removeAttribute('inert')
  }

  addBtn?.addEventListener('click', openSidebar)
  closeBtn?.addEventListener('click', closeSidebar)
  overlay?.addEventListener('click', closeSidebar)

  tabSingle?.addEventListener('click', () => {
    tabSingle.classList.add('active')
    tabFeed?.classList.remove('active')
    singleContent?.classList.remove('hidden')
    feedContent?.classList.add('hidden')
  })

  tabFeed?.addEventListener('click', () => {
    tabFeed.classList.add('active')
    tabSingle?.classList.remove('active')
    feedContent?.classList.remove('hidden')
    singleContent?.classList.add('hidden')
  })

  const singleBtns = document.querySelectorAll('#sidebar-single .position-btn')
  singleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      singleBtns.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      selectedSinglePosition = (btn as HTMLElement).dataset.position as 'head' | 'tail'
    })
  })

  const addSingleBtn = document.getElementById('sidebar-add-single')
  addSingleBtn?.addEventListener('click', () => {
    const titleInput = document.getElementById('sidebar-episode-title') as HTMLInputElement
    const urlInput = document.getElementById('sidebar-episode-url') as HTMLInputElement
    const durationInput = document.getElementById('sidebar-episode-duration') as HTMLInputElement

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

    addEpisode(episode, selectedSinglePosition)
    renderEpisodes()

    titleInput.value = ''
    urlInput.value = ''
    durationInput.value = ''

    showImportStatus(`Added "${title}" to ${selectedSinglePosition === 'head' ? 'beginning' : 'end'} of queue`)
  })

  const fetchFeedBtn = document.getElementById('sidebar-fetch-feed')
  const feedPreview = document.getElementById('sidebar-feed-preview')
  const feedStatus = document.getElementById('sidebar-feed-status')
  const feedEpisodeList = document.getElementById('sidebar-episode-list')

  fetchFeedBtn?.addEventListener('click', async () => {
    const urlInput = document.getElementById('sidebar-feed-url') as HTMLInputElement
    const url = urlInput.value.trim()

    if (!url) {
      feedStatus!.textContent = 'Please enter a feed URL'
      return
    }

    feedStatus!.textContent = 'Fetching feed...'
    feedPreview?.classList.add('hidden')

    try {
      const feed = await parseFeed(url)
      feedPreviewEpisodes = feed.episodes
      feedStatus!.textContent = `Found ${feed.episodes.length} episodes from "${feed.title}"`
      renderFeedPreview()
      feedPreview?.classList.remove('hidden')
    } catch (e) {
      feedStatus!.textContent = `Error: ${e instanceof Error ? e.message : 'Failed to parse feed'}`
    }
  })

  const feedPositionBtns = document.querySelectorAll('#sidebar-feed .position-btn')
  feedPositionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      feedPositionBtns.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      selectedFeedPosition = (btn as HTMLElement).dataset.position as 'head' | 'tail'
    })
  })

  const sortBtns = document.querySelectorAll('.sort-btn')
  sortBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      sortBtns.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      selectedFeedOrder = (btn as HTMLElement).dataset.order as 'asc' | 'desc'
      renderFeedPreview()
    })
  })

  function renderFeedPreview() {
    const feedEpisodeList = document.getElementById('sidebar-episode-list')
    if (!feedEpisodeList) return

    const episodes = [...feedPreviewEpisodes]
    if (selectedFeedOrder === 'asc') {
      episodes.sort((a, b) => (a.pubDate || 0) - (b.pubDate || 0))
    } else {
      episodes.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0))
    }

    feedEpisodeList.innerHTML = ''
    episodes.forEach((ep, idx) => {
      const div = document.createElement('div')
      div.className = 'feed-episode-item'
      div.innerHTML = `
        <span class="feed-episode-number">${idx + 1}.</span>
        <span class="episode-title">${ep.title}</span>
        <span class="episode-duration">${formatDuration(ep.duration)}</span>
      `
      feedEpisodeList.appendChild(div)
    })
  }

  const addFeedBtn = document.getElementById('sidebar-add-feed')
  addFeedBtn?.addEventListener('click', async () => {
    if (feedPreviewEpisodes.length === 0) {
      alert('No episodes to add. Please fetch a feed first.')
      return
    }

    const episodes = [...feedPreviewEpisodes]
    if (selectedFeedOrder === 'desc') {
      episodes.reverse()
    }

    const position = selectedFeedPosition
    for (const ep of episodes) {
      await addEpisode(ep, position)
    }

    renderEpisodes()

    const accountId = getAccountId()
    if (accountId && episodes.length > 0) {
      try {
        await addEpisodesApi(accountId, episodes)
      } catch (e) {
        console.error('Failed to save episodes:', e)
      }
    }

    feedPreviewEpisodes = []
    feedPreview?.classList.add('hidden')
    const urlInput = document.getElementById('sidebar-feed-url') as HTMLInputElement
    urlInput.value = ''

    showImportStatus(`Added ${episodes.length} episodes to ${position === 'head' ? 'beginning' : 'end'} of queue`)
    closeSidebar()
  })
}

function showImportStatus(message: string) {
  const status = document.getElementById('import-status')
  if (status) {
    status.textContent = message
    setTimeout(() => {
      status.textContent = ''
    }, 3000)
  }
}

async function initPlayer(accountId: string) {
  await loadEpisodes(accountId)
  const audio = document.getElementById('audio-player') as HTMLAudioElement
  player = new Player(audio)
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