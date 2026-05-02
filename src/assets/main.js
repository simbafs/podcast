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

  // src/lib/player.ts
  var EPISODES = [
    { id: "ep1", title: "Introduction to Cloudflare Workers", audioUrl: "/audio/ep1.mp3", duration: 3735 },
    { id: "ep2", title: "Durable Objects Deep Dive", audioUrl: "/audio/ep2.mp3", duration: 3330 },
    { id: "ep3", title: "Building APIs with Hono", audioUrl: "/audio/ep3.mp3", duration: 2925 }
  ];
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
      const idx = EPISODES.findIndex((e) => e.id === currentId);
      if (idx > 0) {
        player?.playEpisode(EPISODES[idx - 1].id);
      }
    });
    document.getElementById("next-btn")?.addEventListener("click", () => {
      const currentId = player?.getCurrentEpisodeId();
      if (!currentId) return;
      const idx = EPISODES.findIndex((e) => e.id === currentId);
      if (idx < EPISODES.length - 1) {
        player?.playEpisode(EPISODES[idx + 1].id);
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
    document.getElementById("account-id-display").textContent = accountId;
    document.getElementById("device-id-display").textContent = getDeviceId();
  }
  function showNoAccount() {
    document.getElementById("account-info")?.classList.add("hidden");
    document.getElementById("no-account")?.classList.remove("hidden");
  }
  async function initPlayer(accountId) {
    const audio = document.getElementById("audio-player");
    player = new Player(audio);
    await player.init();
  }
  document.addEventListener("DOMContentLoaded", initApp);
})();
