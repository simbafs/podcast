"use strict";
(() => {
  // src/lib/storage.ts
  var STORAGE_KEYS = {
    ACCOUNT_ID: "podcast_account_id",
    SESSION_ID: "podcast_session_id",
    RSS_URL: "podcast_rss_url",
    LAST_FETCHED_AT: "podcast_last_fetched_at",
    EPISODES: "podcast_episodes",
    ORDER: "podcast_order"
  };
  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
  function getSessionId() {
    let sessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
    if (!sessionId) {
      sessionId = generateUUID();
      sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    }
    return sessionId;
  }
  function getAccountId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlAccountId = urlParams.get("account");
    if (urlAccountId) {
      setAccountId(urlAccountId);
      window.history.replaceState({}, "", window.location.pathname);
      return urlAccountId;
    }
    return localStorage.getItem(STORAGE_KEYS.ACCOUNT_ID);
  }
  function setAccountId(accountId2) {
    localStorage.setItem(STORAGE_KEYS.ACCOUNT_ID, accountId2);
  }
  function getRssUrl() {
    return localStorage.getItem(STORAGE_KEYS.RSS_URL);
  }
  function setRssUrl(url) {
    localStorage.setItem(STORAGE_KEYS.RSS_URL, url);
  }
  function getLastFetchedAt() {
    const val = localStorage.getItem(STORAGE_KEYS.LAST_FETCHED_AT);
    return val ? parseInt(val, 10) : null;
  }
  function setLastFetchedAt(timestamp) {
    localStorage.setItem(STORAGE_KEYS.LAST_FETCHED_AT, String(timestamp));
  }
  function getEpisodes() {
    const val = localStorage.getItem(STORAGE_KEYS.EPISODES);
    return val ? JSON.parse(val) : [];
  }
  function setEpisodes(episodes) {
    localStorage.setItem(STORAGE_KEYS.EPISODES, JSON.stringify(episodes));
  }
  function shouldRefetch() {
    const lastFetched = getLastFetchedAt();
    if (!lastFetched) return false;
    const DAY_MS = 24 * 60 * 60 * 1e3;
    return Date.now() - lastFetched > DAY_MS;
  }
  function getOrder() {
    const val = localStorage.getItem(STORAGE_KEYS.ORDER);
    return val === "new-to-old" || val === "old-to-new" ? val : "old-to-new";
  }
  function setOrder(order) {
    localStorage.setItem(STORAGE_KEYS.ORDER, order);
  }

  // src/lib/api.ts
  var API_BASE = "";
  async function fetchState(accountId2, sessionId) {
    const res = await fetch(
      `${API_BASE}/api/state?accountId=${encodeURIComponent(accountId2)}&sessionId=${encodeURIComponent(sessionId)}`
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to fetch state");
    }
    return res.json();
  }
  async function updateProgress(body) {
    const res = await fetch(`${API_BASE}/api/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to update progress");
    }
    return res.json();
  }
  async function saveFeedUrl(accountId2, sessionId, rssUrl, order) {
    const res = await fetch(`${API_BASE}/api/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: accountId2, sessionId, rssUrl, order })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to save feed URL");
    }
    return res.json();
  }
  async function takeover(accountId2, sessionId) {
    const res = await fetch(`${API_BASE}/api/takeover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: accountId2, sessionId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to takeover");
    }
    return res.json();
  }
  function generateUUID2() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }

  // src/lib/player.ts
  var SYNC_INTERVAL = 12e4;
  var SEEK_DEBOUNCE = 5e3;
  var Player = class {
    audio;
    accountId;
    sessionId;
    currentEpisodeId = null;
    isPlaying = false;
    syncTimer = null;
    seekTimeout = null;
    constructor(audio, accountId2) {
      this.audio = audio;
      this.accountId = accountId2;
      this.sessionId = getSessionId();
      this.audio.addEventListener("timeupdate", () => this.onTimeUpdate());
      this.audio.addEventListener("play", () => this.onPlay());
      this.audio.addEventListener("pause", () => this.onPause());
      this.audio.addEventListener("ended", () => this.onEnded());
      this.audio.addEventListener("loadedmetadata", () => this.onLoadedMetadata());
      window.addEventListener("beforeunload", () => this.syncBeforeUnload());
    }
    async init() {
      try {
        const state = await fetchState(this.accountId, this.sessionId);
        if (state.progress && Object.keys(state.progress).length > 0) {
          const episodes = getEpisodes();
          const firstEpisodeId = Object.keys(state.progress)[0];
          const episode = episodes.find((e) => e.id === firstEpisodeId);
          if (episode) {
            this.currentEpisodeId = episode.id;
            this.audio.src = episode.audioUrl;
            this.audio.currentTime = state.progress[firstEpisodeId]?.positionSec || 0;
            this.updateUI();
          }
        }
      } catch (e) {
        console.error("Failed to init player:", e);
      }
    }
    async playEpisode(episodeId) {
      const episodes = getEpisodes();
      const episode = episodes.find((e) => e.id === episodeId);
      if (!episode) return;
      const wasPlaying = this.isPlaying;
      const fromEpisodeId = this.currentEpisodeId;
      const fromPositionSec = Math.floor(this.audio.currentTime);
      this.currentEpisodeId = episodeId;
      this.audio.src = episode.audioUrl;
      try {
        const state = await fetchState(this.accountId, this.sessionId);
        if (state.progress[episodeId]) {
          this.audio.currentTime = state.progress[episodeId].positionSec;
        }
      } catch (e) {
        console.error("Failed to fetch progress:", e);
      }
      this.updateUI();
      if (fromEpisodeId && fromEpisodeId !== episodeId) {
        try {
          await this.syncProgressWithTakeover(fromEpisodeId, fromPositionSec);
        } catch (e) {
          console.error("Failed to save previous progress:", e);
        }
      }
      if (wasPlaying) {
        await this.audio.play();
      }
    }
    async syncProgressWithTakeover(episodeId, positionSec) {
      try {
        await updateProgress({
          accountId: this.accountId,
          sessionId: this.sessionId,
          episodeId,
          positionSec
        });
      } catch (e) {
        const err = e;
        if (err.message.includes("Only active session")) {
          await takeover(this.accountId, this.sessionId);
          await updateProgress({
            accountId: this.accountId,
            sessionId: this.sessionId,
            episodeId,
            positionSec
          });
        } else {
          throw e;
        }
      }
    }
    toggle() {
      if (this.isPlaying) {
        this.audio.pause();
      } else {
        this.audio.play();
      }
    }
    seek(percent) {
      const time = percent / 100 * this.audio.duration;
      this.audio.currentTime = time;
      if (this.seekTimeout) clearTimeout(this.seekTimeout);
      this.seekTimeout = window.setTimeout(() => {
        this.syncProgress();
      }, SEEK_DEBOUNCE);
    }
    onTimeUpdate() {
      const positionSec = Math.floor(this.audio.currentTime);
      const durationSec = Math.floor(this.audio.duration || 0);
      document.getElementById("current-time").textContent = this.formatTime(positionSec);
      document.getElementById("duration").textContent = this.formatTime(durationSec);
      const slider = document.getElementById("progress-slider");
      if (this.audio.duration) {
        slider.value = String(this.audio.currentTime / this.audio.duration * 100);
      }
    }
    onPlay() {
      this.isPlaying = true;
      this.updatePlayButton();
      this.startSyncTimer();
      this.syncProgress();
    }
    onPause() {
      this.isPlaying = false;
      this.updatePlayButton();
      this.stopSyncTimer();
      this.syncProgress();
    }
    onEnded() {
      this.isPlaying = false;
      this.updatePlayButton();
      this.syncProgress();
    }
    onLoadedMetadata() {
      this.updateUI();
    }
    startSyncTimer() {
      this.stopSyncTimer();
      this.syncTimer = window.setInterval(() => {
        this.syncProgress();
      }, SYNC_INTERVAL);
    }
    stopSyncTimer() {
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }
    }
    async syncProgress() {
      if (!this.currentEpisodeId) return;
      const positionSec = Math.floor(this.audio.currentTime);
      try {
        this.setSyncStatus("syncing");
        await updateProgress({
          accountId: this.accountId,
          sessionId: this.sessionId,
          episodeId: this.currentEpisodeId,
          positionSec
        });
        this.setSyncStatus("synced");
      } catch (e) {
        const err = e;
        if (err.message.includes("Only active session")) {
          try {
            await takeover(this.accountId, this.sessionId);
            await updateProgress({
              accountId: this.accountId,
              sessionId: this.sessionId,
              episodeId: this.currentEpisodeId,
              positionSec
            });
            this.setSyncStatus("synced");
          } catch {
            this.setSyncStatus("error");
          }
        } else {
          this.setSyncStatus("error");
        }
      }
    }
    async syncBeforeUnload() {
      if (!this.currentEpisodeId) return;
      const positionSec = Math.floor(this.audio.currentTime);
      const body = JSON.stringify({
        accountId: this.accountId,
        sessionId: this.sessionId,
        episodeId: this.currentEpisodeId,
        positionSec
      });
      navigator.sendBeacon("/api/progress", body);
    }
    updateUI() {
      if (!this.currentEpisodeId) return;
      const episodes = getEpisodes();
      const episode = episodes.find((e) => e.id === this.currentEpisodeId);
      if (!episode) return;
      document.getElementById("now-playing-title").textContent = episode.title;
      document.querySelectorAll(".episode-item").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-episode") === this.currentEpisodeId);
      });
      this.updatePlayButton();
    }
    updatePlayButton() {
      const playIcon = document.querySelector(".play-icon");
      const pauseIcon = document.querySelector(".pause-icon");
      if (this.isPlaying) {
        playIcon?.classList.add("hidden");
        pauseIcon?.classList.remove("hidden");
      } else {
        playIcon?.classList.remove("hidden");
        pauseIcon?.classList.add("hidden");
      }
    }
    setSyncStatus(status) {
      const indicator = document.getElementById("sync-indicator");
      const text = document.getElementById("sync-text");
      if (indicator) {
        indicator.className = "sync-indicator";
        if (status === "syncing") indicator.classList.add("syncing");
        if (status === "error") indicator.classList.add("error");
      }
      if (text) {
        text.textContent = status === "syncing" ? "Syncing..." : status === "error" ? "Sync Error" : "Synced";
      }
    }
    formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    getCurrentEpisodeId() {
      return this.currentEpisodeId;
    }
    getIsPlaying() {
      return this.isPlaying;
    }
  };

  // src/lib/rss.ts
  async function parseFeed(url) {
    let response;
    try {
      response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status}`);
      }
    } catch {
      response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status}`);
      }
    }
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      throw new Error("Invalid XML format");
    }
    const channel = doc.querySelector("channel");
    if (!channel) {
      throw new Error("No channel found in feed");
    }
    const title = channel.querySelector("title")?.textContent || "Unknown Podcast";
    const description = channel.querySelector("description")?.textContent || "";
    const imageEl = channel.querySelector("image > url") || channel.querySelector("image[href]");
    const imageUrl = imageEl?.getAttribute("href") || imageEl?.textContent || "";
    const items = channel.querySelectorAll("item");
    const episodes = [];
    for (const item of items) {
      const epTitle = item.querySelector("title")?.textContent || "Untitled";
      const enclosure = item.querySelector("enclosure");
      const audioUrl = enclosure?.getAttribute("url") || "";
      const guidEl = item.querySelector("guid");
      let id = guidEl?.textContent || "";
      if (!id) {
        id = audioUrl;
      }
      if (!id) {
        id = generateUUID2();
      }
      let duration = 0;
      const durationStr = item.querySelector("itunes\\:duration, duration")?.textContent;
      if (durationStr) {
        duration = parseDuration(durationStr);
      }
      let pubDate;
      const pubDateStr = item.querySelector("pubDate")?.textContent;
      if (pubDateStr) {
        pubDate = new Date(pubDateStr).getTime();
      }
      if (audioUrl) {
        episodes.push({
          id,
          title: epTitle,
          audioUrl,
          duration,
          pubDate
        });
      }
    }
    episodes.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
    return { title, description, imageUrl, episodes };
  }
  function parseDuration(str) {
    const parts = str.split(":").map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      return parts[0];
    }
    return 0;
  }

  // src/main.ts
  var player;
  var accountId;
  var THEME_KEY = "podcast-theme";
  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY) || "dark";
  }
  function applyTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    const root = document.documentElement;
    const iconDark = document.getElementById("theme-icon-dark");
    const iconLight = document.getElementById("theme-icon-light");
    const iconSystem = document.getElementById("theme-icon-system");
    iconDark?.classList.add("hidden");
    iconLight?.classList.add("hidden");
    iconSystem?.classList.add("hidden");
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.setAttribute("data-theme", prefersDark ? "dark" : "light");
      iconSystem?.classList.remove("hidden");
    } else {
      root.setAttribute("data-theme", theme);
      if (theme === "light") {
        iconLight?.classList.remove("hidden");
      } else {
        iconDark?.classList.remove("hidden");
      }
    }
  }
  function cycleTheme() {
    const current = getStoredTheme();
    const order = ["dark", "light", "system"];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    applyTheme(next);
  }
  function initTheme() {
    applyTheme(getStoredTheme());
    document.getElementById("theme-toggle")?.addEventListener("click", cycleTheme);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getStoredTheme() === "system") {
        applyTheme("system");
      }
    });
  }
  function generateShareLink(accountId2) {
    const url = new URL(window.location.href);
    url.searchParams.set("account", accountId2);
    return url.toString();
  }
  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  function renderEpisodes() {
    const list = document.getElementById("episode-list");
    if (!list) return;
    list.innerHTML = "";
    let episodes = [...getEpisodes()];
    const order = getOrder();
    if (order === "new-to-old") {
      episodes.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
    } else {
      episodes.sort((a, b) => (a.pubDate || 0) - (b.pubDate || 0));
    }
    if (episodes.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:2rem">No episodes. Enter an RSS feed URL above.</p>';
      return;
    }
    episodes.forEach((ep) => {
      const div = document.createElement("div");
      div.className = "episode-item";
      div.setAttribute("data-episode", ep.id);
      div.innerHTML = `
      <div class="episode-info">
        <span class="episode-title">${ep.title}</span>
      </div>
      <span class="episode-duration">${formatDuration(ep.duration)}</span>
    `;
      div.addEventListener("click", () => {
        player?.playEpisode(ep.id);
      });
      list.appendChild(div);
    });
  }
  function updateUiState(hasEpisodes) {
    const main = document.querySelector(".main");
    if (hasEpisodes) {
      main?.classList.add("has-episodes");
    } else {
      main?.classList.remove("has-episodes");
    }
  }
  async function loadFeed(url, currentAccountId) {
    const statusEl = document.getElementById("feed-status");
    const sessionId = getSessionId();
    statusEl.textContent = "Fetching feed...";
    try {
      const feed = await parseFeed(url);
      setRssUrl(url);
      setEpisodes(feed.episodes);
      setLastFetchedAt(Date.now());
      try {
        await saveFeedUrl(currentAccountId, sessionId, url);
      } catch (e) {
        const err = e;
        if (err.message.includes("Only active session")) {
          await takeover(currentAccountId, sessionId);
          await saveFeedUrl(currentAccountId, sessionId, url);
        } else {
          throw e;
        }
      }
      statusEl.textContent = `Loaded ${feed.episodes.length} episodes from "${feed.title}"`;
      updateUiState(true);
      renderEpisodes();
    } catch (e) {
      statusEl.textContent = `Error: ${e instanceof Error ? e.message : "Failed to parse feed"}`;
    }
  }
  async function initApp() {
    accountId = getAccountId() || generateUUID2();
    setAccountId(accountId);
    const currentAccountId = getAccountId();
    const currentSessionId = getSessionId();
    document.getElementById("device-badge").textContent = `${currentAccountId?.slice(0, 6)} (${currentSessionId.slice(0, 6)})`;
    initTheme();
    const feedInput = document.getElementById("rss-url");
    const fetchBtn = document.getElementById("fetch-feed-btn");
    const statusEl = document.getElementById("feed-status");
    const settingsDialog = document.getElementById("settings-dialog");
    const settingsRssInput = document.getElementById("settings-rss-url");
    fetchBtn?.addEventListener("click", async () => {
      const url = feedInput.value.trim();
      if (!url) {
        statusEl.textContent = "Please enter a feed URL";
        return;
      }
      await loadFeed(url, accountId);
    });
    document.getElementById("refetch-btn")?.addEventListener("click", async () => {
      const currentUrl = getRssUrl();
      if (currentUrl) {
        await loadFeed(currentUrl, accountId);
      }
    });
    document.getElementById("reverse-btn")?.addEventListener("click", async () => {
      const currentOrder = getOrder();
      const newOrder = currentOrder === "new-to-old" ? "old-to-new" : "new-to-old";
      setOrder(newOrder);
      const sessionId = getSessionId();
      try {
        await saveFeedUrl(accountId, sessionId, getRssUrl() || "", newOrder);
      } catch (e) {
        console.error("Failed to sync order:", e);
      }
      renderEpisodes();
    });
    document.getElementById("episode-reverse-btn")?.addEventListener("click", async () => {
      const currentOrder = getOrder();
      const newOrder = currentOrder === "new-to-old" ? "old-to-new" : "new-to-old";
      setOrder(newOrder);
      const sessionId = getSessionId();
      try {
        await saveFeedUrl(accountId, sessionId, getRssUrl() || "", newOrder);
      } catch (e) {
        console.error("Failed to sync order:", e);
      }
      renderEpisodes();
    });
    document.getElementById("clear-btn")?.addEventListener("click", async () => {
      setEpisodes([]);
      setRssUrl("");
      setLastFetchedAt(0);
      setOrder("old-to-new");
      const sessionId = getSessionId();
      try {
        await saveFeedUrl(accountId, sessionId, "", "old-to-new");
      } catch (e) {
        console.error("Failed to clear feed URL:", e);
      }
      updateUiState(false);
      renderEpisodes();
      feedInput.value = "";
    });
    document.getElementById("settings-btn")?.addEventListener("click", () => {
      settingsRssInput.value = getRssUrl() || "";
      settingsDialog.showModal();
    });
    document.getElementById("settings-close")?.addEventListener("click", () => {
      settingsDialog.close();
    });
    settingsDialog.addEventListener("submit", async (e) => {
      e.preventDefault();
      const url = settingsRssInput.value.trim();
      if (url) {
        feedInput.value = url;
        await loadFeed(url, accountId);
        settingsDialog.close();
      }
    });
    document.getElementById("share-btn")?.addEventListener("click", () => {
      const link = generateShareLink(accountId);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => {
          const btn = document.getElementById("share-btn");
          if (btn) {
            const origText = btn.innerHTML;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
            setTimeout(() => btn.innerHTML = origText, 2e3);
          }
        });
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = link;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          const btn = document.getElementById("share-btn");
          if (btn) {
            const origText = btn.innerHTML;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
            setTimeout(() => btn.innerHTML = origText, 2e3);
          }
        } catch {
          alert(`Share link: ${link}`);
        }
        document.body.removeChild(textArea);
      }
    });
    document.getElementById("play-btn")?.addEventListener("click", () => {
      player?.toggle();
    });
    document.getElementById("prev-btn")?.addEventListener("click", () => {
      const currentId = player?.getCurrentEpisodeId();
      if (!currentId) return;
      let episodes = [...getEpisodes()];
      const order = getOrder();
      if (order === "new-to-old") {
        episodes.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
      } else {
        episodes.sort((a, b) => (a.pubDate || 0) - (b.pubDate || 0));
      }
      const idx = episodes.findIndex((e) => e.id === currentId);
      if (idx > 0) {
        player?.playEpisode(episodes[idx - 1].id);
      }
    });
    document.getElementById("next-btn")?.addEventListener("click", () => {
      const currentId = player?.getCurrentEpisodeId();
      if (!currentId) return;
      let episodes = [...getEpisodes()];
      const order = getOrder();
      if (order === "new-to-old") {
        episodes.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
      } else {
        episodes.sort((a, b) => (a.pubDate || 0) - (b.pubDate || 0));
      }
      const idx = episodes.findIndex((e) => e.id === currentId);
      if (idx < episodes.length - 1) {
        player?.playEpisode(episodes[idx + 1].id);
      }
    });
    document.getElementById("progress-slider")?.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      player?.seek(value);
    });
    try {
      const sessionId = getSessionId();
      const state = await fetchState(accountId, sessionId);
      const serverRssUrl = state.account?.rssUrl || null;
      const serverOrder = state.account?.order || "old-to-new";
      setOrder(serverOrder);
      if (serverRssUrl) {
        setRssUrl(serverRssUrl);
        feedInput.value = serverRssUrl;
        updateUiState(true);
        if (shouldRefetch() || getEpisodes().length === 0) {
          await loadFeed(serverRssUrl, accountId);
        } else {
          renderEpisodes();
        }
      }
    } catch (e) {
      console.error("Failed to fetch state:", e);
    }
    await initPlayer(accountId);
  }
  async function initPlayer(accountId2) {
    const audio = document.getElementById("audio-player");
    player = new Player(audio, accountId2);
    await player.init();
    renderEpisodes();
    const currentEpisodeId = player.getCurrentEpisodeId();
    if (currentEpisodeId) {
      setTimeout(() => {
        const activeEl = document.querySelector(".episode-item.active");
        activeEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }
  document.addEventListener("DOMContentLoaded", initApp);
})();
