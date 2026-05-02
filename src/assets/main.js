"use strict";
(() => {
  // src/lib/storage.ts
  var STORAGE_KEYS = {
    ACCOUNT_ID: "podcast_account_id",
    DEVICE_ID: "podcast_device_id",
    SESSION_ID: "podcast_session_id"
  };
  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
  function getDeviceId() {
    let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = generateUUID();
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    }
    return deviceId;
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
    return localStorage.getItem(STORAGE_KEYS.ACCOUNT_ID);
  }
  function setAccountId(accountId) {
    localStorage.setItem(STORAGE_KEYS.ACCOUNT_ID, accountId);
  }

  // src/lib/api.ts
  var API_BASE = "";
  async function fetchState(accountId) {
    const res = await fetch(`${API_BASE}/api/state?accountId=${encodeURIComponent(accountId)}`);
    if (!res.ok) throw new Error("Failed to fetch state");
    return res.json();
  }
  async function updateProgress(body) {
    const res = await fetch(`${API_BASE}/api/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.status === 409) {
      const conflict = await res.json();
      throw conflict;
    }
    if (!res.ok) throw new Error("Failed to update progress");
  }
  async function transition(body) {
    const res = await fetch(`${API_BASE}/api/playback/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.status === 409) {
      const conflict = await res.json();
      throw conflict;
    }
    if (!res.ok) throw new Error("Failed to transition");
  }
  function generateUUID2() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
  async function takeover(body) {
    const res = await fetch(`${API_BASE}/api/playback/takeover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("Failed to takeover");
  }
  async function addEpisodes(accountId, episodes) {
    const res = await fetch(`${API_BASE}/api/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, episodes })
    });
    if (!res.ok) throw new Error("Failed to add episodes");
    return res.json();
  }

  // src/lib/player.ts
  var EPISODES = [];
  function getEpisodes() {
    return EPISODES;
  }
  async function addEpisode(episode) {
    EPISODES.push(episode);
    const accountId = getAccountId();
    if (accountId) {
      try {
        await addEpisodes(accountId, [episode]);
      } catch (e) {
        console.error("Failed to save episode:", e);
      }
    }
  }
  async function loadEpisodes(accountId) {
    try {
      const state = await fetchState(accountId);
      EPISODES = state.episodes || [];
    } catch (e) {
      console.error("Failed to load episodes:", e);
      EPISODES = [];
    }
  }
  var SYNC_INTERVAL = 12e4;
  var SEEK_DEBOUNCE = 5e3;
  var Player = class {
    audio;
    currentEpisodeId = null;
    isPlaying = false;
    syncTimer = null;
    seekTimeout = null;
    pendingSeekSec = null;
    lastSyncedState = null;
    constructor(audio) {
      this.audio = audio;
      this.audio.addEventListener("timeupdate", () => this.onTimeUpdate());
      this.audio.addEventListener("play", () => this.onPlay());
      this.audio.addEventListener("pause", () => this.onPause());
      this.audio.addEventListener("ended", () => this.onEnded());
      this.audio.addEventListener("loadedmetadata", () => this.onLoadedMetadata());
      window.addEventListener("beforeunload", () => this.syncBeforeUnload());
    }
    async init() {
      const accountId = getAccountId();
      if (!accountId) return;
      try {
        const state = await fetchState(accountId);
        if (state.account?.activeEpisodeId) {
          const episode = EPISODES.find((e) => e.id === state.account.activeEpisodeId);
          if (episode) {
            this.currentEpisodeId = episode.id;
            this.audio.src = episode.audioUrl;
            this.audio.currentTime = state.account.positionSec;
            this.updateUI();
          }
        }
      } catch (e) {
        console.error("Failed to init player:", e);
      }
    }
    async playEpisode(episodeId) {
      const accountId = getAccountId();
      if (!accountId) return;
      const episode = EPISODES.find((e) => e.id === episodeId);
      if (!episode) return;
      const wasPlaying = this.isPlaying;
      if (this.currentEpisodeId && this.currentEpisodeId !== episodeId) {
        const fromState = this.isPlaying ? "playing" : "paused";
        await this.transitionTo(episodeId, fromState);
        return;
      }
      this.currentEpisodeId = episodeId;
      this.audio.src = episode.audioUrl;
      const state = await fetchState(accountId);
      const progress = state.progress[episodeId];
      if (progress) {
        this.audio.currentTime = progress.positionSec;
      }
      this.updateUI();
      if (wasPlaying) {
        await this.audio.play();
      }
    }
    async transitionTo(newEpisodeId, fromState) {
      const accountId = getAccountId();
      if (!accountId) return;
      const sessionId = getSessionId();
      const deviceId = getDeviceId();
      const fromEpisode = EPISODES.find((e) => e.id === this.currentEpisodeId);
      const toEpisode = EPISODES.find((e) => e.id === newEpisodeId);
      if (!fromEpisode || !toEpisode) return;
      try {
        await transition({
          accountId,
          sessionId,
          deviceId,
          from: {
            episodeId: fromEpisode.id,
            positionSec: Math.floor(this.audio.currentTime),
            state: fromState
          },
          to: {
            episodeId: toEpisode.id,
            positionSec: 0,
            state: "playing"
          }
        });
        this.currentEpisodeId = newEpisodeId;
        this.audio.src = toEpisode.audioUrl;
        this.updateUI();
        await this.audio.play();
      } catch (e) {
        if (e.error === "conflict") {
          this.showConflictModal(e.activeDeviceId);
        }
      }
    }
    showConflictModal(activeDeviceId) {
      const modal = document.getElementById("conflict-modal");
      const deviceEl = document.getElementById("conflict-device");
      if (modal && deviceEl) {
        deviceEl.textContent = `Device: ${activeDeviceId.slice(0, 8)}...`;
        modal.classList.remove("hidden");
      }
    }
    async handleTakeover() {
      const accountId = getAccountId();
      if (!accountId || !this.currentEpisodeId) return;
      const sessionId = getSessionId();
      const deviceId = getDeviceId();
      await takeover({
        accountId,
        sessionId,
        deviceId,
        episodeId: this.currentEpisodeId,
        positionSec: Math.floor(this.audio.currentTime),
        state: this.isPlaying ? "playing" : "paused"
      });
      document.getElementById("conflict-modal")?.classList.add("hidden");
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
    async onEnded() {
      this.isPlaying = false;
      this.updatePlayButton();
      this.syncProgress("ended");
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
    async syncProgress(stateOverride) {
      const accountId = getAccountId();
      if (!accountId || !this.currentEpisodeId) return;
      const sessionId = getSessionId();
      const deviceId = getDeviceId();
      const positionSec = Math.floor(this.audio.currentTime);
      const state = stateOverride || (this.isPlaying ? "playing" : "paused");
      const key = `${positionSec}-${state}`;
      if (this.lastSyncedState && this.lastSyncedState.key === key) return;
      try {
        this.setSyncStatus("syncing");
        await updateProgress({
          accountId,
          sessionId,
          deviceId,
          episodeId: this.currentEpisodeId,
          positionSec,
          durationSec: Math.floor(this.audio.duration),
          state
        });
        this.lastSyncedState = { positionSec, state, key };
        this.setSyncStatus("synced");
      } catch (e) {
        if (e.error === "conflict") {
          this.showConflictModal(e.activeDeviceId);
          this.setSyncStatus("error");
        }
      }
    }
    async syncBeforeUnload() {
      const accountId = getAccountId();
      if (!accountId || !this.currentEpisodeId) return;
      const sessionId = getSessionId();
      const deviceId = getDeviceId();
      const positionSec = Math.floor(this.audio.currentTime);
      const state = this.isPlaying ? "playing" : "paused";
      const body = JSON.stringify({
        accountId,
        sessionId,
        deviceId,
        episodeId: this.currentEpisodeId,
        positionSec,
        state
      });
      navigator.sendBeacon("/api/progress", body);
    }
    updateUI() {
      if (!this.currentEpisodeId) return;
      const episode = EPISODES.find((e) => e.id === this.currentEpisodeId);
      if (!episode) return;
      document.getElementById("now-playing-title").textContent = episode.title;
      document.getElementById("now-playing-episode").textContent = `Episode ${episode.id.replace("ep", "")}`;
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
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status}`);
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
      const epUrl = item.querySelector("enclosure")?.getAttribute("url") || "";
      let duration = 0;
      const durationStr = item.querySelector("itunes\\:duration, duration")?.textContent;
      if (durationStr) {
        duration = parseDuration(durationStr);
      }
      if (epUrl) {
        episodes.push({
          id: generateUUID2(),
          title: epTitle,
          audioUrl: epUrl,
          duration
        });
      }
    }
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
  function generateShareLink(accountId) {
    const url = new URL(window.location.href);
    url.searchParams.set("account", accountId);
    return url.toString();
  }
  async function initApp() {
    const accountId = getAccountId();
    const deviceId = getDeviceId();
    const urlParams = new URLSearchParams(window.location.search);
    const urlAccountId = urlParams.get("account");
    document.getElementById("device-badge").textContent = `Device: ${deviceId.slice(0, 8)}`;
    if (urlAccountId && urlAccountId !== accountId) {
      setAccountId(urlAccountId);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const currentAccountId = getAccountId();
    if (currentAccountId) {
      showAccountInfo(currentAccountId);
      await initPlayer(currentAccountId);
    } else {
      showNoAccount();
    }
    initTabs();
    initAddEpisodeForm();
    initFeedImport();
    document.getElementById("create-account-btn")?.addEventListener("click", async () => {
      const newAccountId = generateUUID2();
      setAccountId(newAccountId);
      showAccountInfo(newAccountId);
      await initPlayer(newAccountId);
    });
    document.getElementById("share-btn")?.addEventListener("click", () => {
      const accountId2 = getAccountId();
      if (accountId2) {
        const link = generateShareLink(accountId2);
        navigator.clipboard.writeText(link).then(() => {
          const btn = document.getElementById("share-btn");
          if (btn) {
            const origText = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => btn.textContent = origText, 2e3);
          }
        });
      }
    });
    document.getElementById("play-btn")?.addEventListener("click", () => {
      player?.toggle();
    });
    document.getElementById("prev-btn")?.addEventListener("click", () => {
      const currentId = player?.getCurrentEpisodeId();
      if (!currentId) return;
      const episodes = getEpisodes();
      const idx = episodes.findIndex((e) => e.id === currentId);
      if (idx > 0) {
        player?.playEpisode(episodes[idx - 1].id);
      }
    });
    document.getElementById("next-btn")?.addEventListener("click", () => {
      const currentId = player?.getCurrentEpisodeId();
      if (!currentId) return;
      const episodes = getEpisodes();
      const idx = episodes.findIndex((e) => e.id === currentId);
      if (idx < episodes.length - 1) {
        player?.playEpisode(episodes[idx + 1].id);
      }
    });
    document.querySelectorAll(".episode-item").forEach((el) => {
      el.addEventListener("click", () => {
        const episodeId = el.getAttribute("data-episode");
        if (episodeId) {
          player?.playEpisode(episodeId);
        }
      });
    });
    document.getElementById("progress-slider")?.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      player?.seek(value);
    });
    document.getElementById("cancel-conflict")?.addEventListener("click", () => {
      document.getElementById("conflict-modal")?.classList.add("hidden");
    });
    document.getElementById("takeover-btn")?.addEventListener("click", () => {
      player?.handleTakeover();
    });
  }
  function showAccountInfo(accountId) {
    document.getElementById("account-info")?.classList.remove("hidden");
    document.getElementById("no-account")?.classList.add("hidden");
  }
  function showNoAccount() {
    document.getElementById("account-info")?.classList.add("hidden");
    document.getElementById("no-account")?.classList.remove("hidden");
  }
  function renderEpisodes() {
    const list = document.getElementById("episode-list");
    if (!list) return;
    list.innerHTML = "";
    const episodes = getEpisodes();
    if (episodes.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:2rem">No episodes yet</p>';
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
  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  function initAddEpisodeForm() {
    const btn = document.getElementById("add-episode-btn");
    btn?.addEventListener("click", () => {
      const titleInput = document.getElementById("episode-title");
      const urlInput = document.getElementById("episode-url");
      const durationInput = document.getElementById("episode-duration");
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      const duration = parseInt(durationInput.value, 10);
      if (!title || !url || isNaN(duration)) {
        alert("Please fill in all fields");
        return;
      }
      const episode = {
        id: generateUUID2(),
        title,
        audioUrl: url,
        duration
      };
      addEpisode(episode);
      renderEpisodes();
      titleInput.value = "";
      urlInput.value = "";
      durationInput.value = "";
    });
  }
  function initTabs() {
    const tabSingle = document.getElementById("tab-single");
    const tabFeed = document.getElementById("tab-feed");
    const formSingle = document.getElementById("add-episode-form");
    const formFeed = document.getElementById("import-feed-form");
    tabSingle?.addEventListener("click", () => {
      tabSingle.classList.add("active");
      tabFeed?.classList.remove("active");
      formSingle?.classList.remove("hidden");
      formFeed?.classList.add("hidden");
    });
    tabFeed?.addEventListener("click", () => {
      tabFeed.classList.add("active");
      tabSingle?.classList.remove("active");
      formFeed?.classList.remove("hidden");
      formSingle?.classList.add("hidden");
    });
  }
  function initFeedImport() {
    const btn = document.getElementById("import-feed-btn");
    const status = document.getElementById("import-status");
    btn?.addEventListener("click", async () => {
      const urlInput = document.getElementById("feed-url");
      const url = urlInput.value.trim();
      if (!url) {
        status.textContent = "Please enter a feed URL";
        return;
      }
      status.textContent = "Fetching feed...";
      try {
        const feed = await parseFeed(url);
        const accountId = getAccountId();
        for (const ep of feed.episodes) {
          addEpisode(ep);
        }
        if (accountId && feed.episodes.length > 0) {
          try {
            await addEpisodes(accountId, feed.episodes);
          } catch (e) {
            console.error("Failed to save episodes:", e);
          }
        }
        renderEpisodes();
        status.textContent = `Imported ${feed.episodes.length} episodes from "${feed.title}"`;
        urlInput.value = "";
      } catch (e) {
        status.textContent = `Error: ${e instanceof Error ? e.message : "Failed to parse feed"}`;
      }
    });
  }
  async function initPlayer(accountId) {
    await loadEpisodes(accountId);
    const audio = document.getElementById("audio-player");
    player = new Player(audio);
    await player.init();
    renderEpisodes();
  }
  document.addEventListener("DOMContentLoaded", initApp);
})();
