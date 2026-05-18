import { getAccountId, setAccountId, getRssUrl, setRssUrl, getLastFetchedAt, setLastFetchedAt, getEpisodes, setEpisodes, getOrder, setOrder } from './utils.js';

function parseFeed(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const channel = doc.querySelector('channel');
  if (!channel) throw new Error('Invalid RSS feed');

  const title = channel.querySelector('title')?.textContent || 'Unknown';
  const items = Array.from(channel.querySelectorAll('item'));

  const episodes = items.map((item, idx) => {
    const enclosure = item.querySelector('enclosure');
    const audioUrl = enclosure?.getAttribute('url') || '';
    const pubDate = item.querySelector('pubDate')?.textContent;
    const pubDateMs = pubDate ? new Date(pubDate).getTime() : 0;

    return {
      id: `ep-${idx}-${hashCode(audioUrl)}`,
      title: item.querySelector('title')?.textContent || 'Untitled',
      audioUrl,
      duration: parseDuration(item.querySelector('itunes\\:duration')?.textContent || '0'),
      pubDate: pubDateMs,
    };
  }).filter(e => e.audioUrl);

  return { title, episodes };
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h;
}

function parseDuration(dur) {
  if (!dur) return 0;
  if (/^\d+$/.test(dur)) return parseInt(dur, 10);
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

const SYNC_INTERVAL = 30000;
const SEEK_DEBOUNCE = 3000;

class Player {
  constructor(audio) {
    this.audio = audio;
    this.accountId = getAccountId();
    this.currentEpisodeId = null;
    this.isPlaying = false;
    this.syncTimer = null;
    this.seekTimeout = null;
    this.isActiveConnection = false;

    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('play', () => this.onPlay());
    this.audio.addEventListener('pause', () => this.onPause());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());

    window.addEventListener('beforeunload', () => this.syncBeforeUnload());
  }

  setActive(isActive) {
    this.isActiveConnection = isActive;
  }

  async playEpisode(episodeId) {
    const episodes = getEpisodes();
    const episode = episodes.find(e => e.id === episodeId);
    if (!episode) return;

    const fromEpisodeId = this.currentEpisodeId;
    const fromPositionSec = Math.floor(this.audio.currentTime);

    this.currentEpisodeId = episodeId;
    this.audio.src = episode.audioUrl;
    this.updateUI();

    if (fromEpisodeId && fromEpisodeId !== episodeId && this.isActiveConnection) {
      this.sendWS({ type: 'sync', episodeId: fromEpisodeId, positionSec: fromPositionSec, isPlaying: false });
    }
  }

  toggle() {
    if (!this.isActiveConnection) {
      this.setSyncStatus('error');
      return;
    }
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
  }

  seek(percent) {
    if (!this.audio.duration) return;
    const time = (percent / 100) * this.audio.duration;
    this.audio.currentTime = time;

    if (this.seekTimeout) clearTimeout(this.seekTimeout);
    this.seekTimeout = setTimeout(() => {
      if (this.isActiveConnection) {
        this.sendWS({ type: 'seek', positionSec: this.audio.currentTime });
      }
    }, SEEK_DEBOUNCE);
  }

  onTimeUpdate() {
    const pos = Math.floor(this.audio.currentTime);
    const dur = Math.floor(this.audio.duration || 0);

    document.getElementById('current-time').textContent = formatTime(pos);
    document.getElementById('duration').textContent = formatTime(dur);

    const slider = document.getElementById('progress-slider');
    if (this.audio.duration) {
      slider.value = String((this.audio.currentTime / this.audio.duration) * 100);
    }
  }

  onPlay() {
    this.isPlaying = true;
    this.updatePlayButton();
    if (this.isActiveConnection) {
      this.sendWS({ type: 'play', episodeId: this.currentEpisodeId });
      this.startSyncTimer();
    }
  }

  onPause() {
    this.isPlaying = false;
    this.updatePlayButton();
    if (this.isActiveConnection) {
      this.sendWS({ type: 'pause' });
      this.stopSyncTimer();
      this.syncProgress();
    }
  }

  onEnded() {
    this.isPlaying = false;
    this.updatePlayButton();
    if (this.isActiveConnection) {
      this.sendWS({ type: 'sync', episodeId: this.currentEpisodeId, positionSec: this.audio.currentTime, isPlaying: false });
    }
  }

  onLoadedMetadata() {
    this.updateUI();
  }

  startSyncTimer() {
    this.stopSyncTimer();
    this.syncTimer = setInterval(() => this.syncProgress(), SYNC_INTERVAL);
  }

  stopSyncTimer() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  syncProgress() {
    if (!this.currentEpisodeId || !this.isActiveConnection) return;
    this.setSyncStatus('syncing');
    this.sendWS({ type: 'sync', episodeId: this.currentEpisodeId, positionSec: this.audio.currentTime, isPlaying: this.isPlaying });
    this.setSyncStatus('synced');
  }

  syncBeforeUnload() {
    if (!this.currentEpisodeId || !this.isActiveConnection) return;
    const body = JSON.stringify({
      accountId: this.accountId,
      episodeId: this.currentEpisodeId,
      positionSec: Math.floor(this.audio.currentTime),
    });
    navigator.sendBeacon('/api/progress', body);
  }

  updateUI() {
    if (!this.currentEpisodeId) return;
    const episodes = getEpisodes();
    const episode = episodes.find(e => e.id === this.currentEpisodeId);
    if (!episode) return;

    document.getElementById('now-playing-title').textContent = episode.title;

    document.querySelectorAll('.episode-item').forEach(el => {
      el.classList.toggle('active', el.dataset.episode === this.currentEpisodeId);
    });

    this.updatePlayButton();
  }

  updatePlayButton() {
    const playIcon = document.querySelector('.play-icon');
    const pauseIcon = document.querySelector('.pause-icon');

    if (this.isPlaying) {
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
    } else {
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
    }
  }

  setSyncStatus(status) {
    const indicator = document.getElementById('sync-indicator');
    const text = document.getElementById('sync-text');

    if (indicator) {
      indicator.className = 'sync-indicator';
      if (status === 'syncing') indicator.classList.add('syncing');
      if (status === 'error') indicator.classList.add('error');
    }

    if (text) {
      text.textContent = status === 'syncing' ? 'Syncing...' : status === 'error' ? 'Sync Error' : 'Synced';
    }
  }

  sendWS(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  handleState(state) {
    if (state.activeConnId) {
      this.setActive(state.activeConnId === this.connId);
    }

    if (state.isPlaying !== undefined) {
      this.isPlaying = state.isPlaying;
      this.updatePlayButton();
    }

    if (state.episodeId && state.episodeId !== this.currentEpisodeId) {
      this.currentEpisodeId = state.episodeId;

      const episodes = getEpisodes();
      if (episodes.length === 0) {
        const rssUrl = getRssUrl();
        if (rssUrl) {
          fetch(rssUrl)
            .then(r => r.text())
            .then(t => parseFeed(t))
            .then(f => {
              setEpisodes(f.episodes);
              renderEpisodes();
              this.updateUI();
            });
          return;
        }
      }

      this.updateUI();
    }

    if (state.positionSec && this.isActiveConnection) {
      if (Math.abs(this.audio.currentTime - state.positionSec) > 2) {
        this.audio.currentTime = state.positionSec;
      }
    }
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

let ws = null;
let player = null;
let myConnId = generateConnId();

async function loadFeed(url) {
  const statusEl = document.getElementById('feed-status');
  statusEl.textContent = 'Fetching feed...';

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch feed');
    const text = await res.text();
    const feed = parseFeed(text);

    setRssUrl(url);
    setEpisodes(feed.episodes);
    setLastFetchedAt(Date.now());

    const order = getOrder();
    await fetch('/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: getAccountId(), rssUrl: url, orderDir: order }),
    });

    statusEl.textContent = `Loaded ${feed.episodes.length} episodes from "${feed.title}"`;
    updateUiState(true);
    renderEpisodes();
  } catch (e) {
    console.error('Failed to load feed:', e);
    statusEl.textContent = 'Failed to load feed';

    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const text = await res.text();
      const feed = parseFeed(text);

      setRssUrl(url);
      setEpisodes(feed.episodes);
      setLastFetchedAt(Date.now());

      const order = getOrder();
      await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: getAccountId(), rssUrl: url, orderDir: order }),
      });

      statusEl.textContent = `Loaded ${feed.episodes.length} episodes from "${feed.title}"`;
      updateUiState(true);
      renderEpisodes();
    } catch (e2) {
      console.error('Proxy also failed:', e2);
      statusEl.textContent = 'Failed to load feed (CORS issue?)';
    }
  }
}

function updateUiState(hasEpisodes) {
  const main = document.getElementById('main');
  main.classList.toggle('has-episodes', hasEpisodes);
}

function renderEpisodes() {
  const list = document.getElementById('episode-list');
  const episodes = getEpisodes();
  const order = getOrder();

  let sorted = [...episodes];
  if (order === 'new-to-old') {
    sorted.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
  } else {
    sorted.sort((a, b) => (a.pubDate || 0) - (b.pubDate || 0));
  }

  list.innerHTML = sorted.map(ep => `
    <div class="episode-item" data-episode="${ep.id}">
      <div class="episode-info">
        <span class="episode-title">${escapeHtml(ep.title)}</span>
        <span class="episode-duration">${formatTime(ep.duration)}</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.episode-item').forEach(el => {
    el.addEventListener('click', () => {
      const epId = el.dataset.episode;
      player.playEpisode(epId);
      if (player.isActiveConnection) {
        player.sendWS({ type: 'play', episodeId: epId });
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function generateConnId() {
  return 'conn-' + Math.random().toString(36).slice(2, 11);
}

function init() {
  const accountId = getAccountId();
  if (!accountId) return;

  document.getElementById('device-badge').textContent = `${accountId.slice(0, 8)}...`;

  player = new Player(document.getElementById('audio'));

  const feedInput = document.getElementById('rss-url');
  const fetchBtn = document.getElementById('fetch-feed-btn');
  const feedStatus = document.getElementById('feed-status');

  fetchBtn?.addEventListener('click', () => {
    const url = feedInput.value.trim();
    if (url) loadFeed(url);
  });

  feedInput?.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      const url = feedInput.value.trim();
      if (url) loadFeed(url);
    }
  });

  const toggleOrderBtn = document.getElementById('toggle-order-btn');
  toggleOrderBtn?.addEventListener('click', async () => {
    const current = getOrder();
    const next = current === 'new-to-old' ? 'old-to-new' : 'new-to-old';
    setOrder(next);
    toggleOrderBtn.textContent = `Order: ${next === 'new-to-old' ? 'New to Old' : 'Old to New'}`;
    renderEpisodes();

    await fetch('/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, rssUrl: getRssUrl() || '', orderDir: next }),
    });
  });

  const takeoverBtn = document.getElementById('takeover-btn');
  takeoverBtn?.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'takeover' }));
    }
  });

  const playPauseBtn = document.getElementById('play-pause-btn');
  playPauseBtn?.addEventListener('click', () => player.toggle());

  const slider = document.getElementById('progress-slider');
  slider?.addEventListener('input', e => {
    player.seek(parseFloat(e.target.value));
  });

  initWebSocket();
  loadInitialState();
}

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    ws.send(JSON.stringify({ type: 'auth', accountId: getAccountId(), connId: myConnId }));
    player.setSyncStatus('synced');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('WS message:', msg);

      if (msg.type === 'connected') {
        myConnId = msg.connId;
        player.connId = myConnId;
      } else if (msg.type === 'state') {
        player.connId = myConnId;
        player.handleState(msg);
      } else if (msg.type === 'error') {
        console.error('WS error:', msg.message);
        player.setSyncStatus('error');
      }
    } catch (e) {
      console.error('Failed to parse WS message:', e);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    player.setSyncStatus('error');
    setTimeout(initWebSocket, 3000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    player.setSyncStatus('error');
  };
}

async function loadInitialState() {
  try {
    const res = await fetch(`/api/state?accountId=${getAccountId()}`);
    const data = await res.json();

    if (data.account?.rssUrl) {
      setRssUrl(data.account.rssUrl);
      document.getElementById('rss-url').value = data.account.rssUrl;
      await loadFeed(data.account.rssUrl);
      return;
    }

    if (data.account?.orderDir) {
      setOrder(data.account.orderDir);
      const toggleOrderBtn = document.getElementById('toggle-order-btn');
      toggleOrderBtn.textContent = `Order: ${data.account.orderDir === 'new-to-old' ? 'New to Old' : 'Old to New'}`;
    }
  } catch (e) {
    console.error('Failed to load initial state:', e);
  }
}

document.addEventListener('DOMContentLoaded', init);