import { useCallback, useEffect, useRef, useState } from "react";
import { parseFeed } from "../lib/rss";
import { fetchRSS, fetchRSSProxy, saveFeed, fetchState } from "../lib/api";
import {
  getAccountId,
  setAccountId,
  getRssUrl,
  setRssUrl,
  getEpisodes,
  setEpisodes,
  getOrder,
  setOrder,
  clearAccount,
} from "../lib/storage";
import type { Episode, WSMessage } from "../lib/types";

const SYNC_INTERVAL = 30_000;

export function useApp() {
  const [accountId, setAccountIdState] = useState(getAccountId);
  const [rssUrl, setRssUrlState] = useState(getRssUrl);
  const [episodes, setEpisodesState] = useState<Episode[]>(getEpisodes);
  const [order, setOrderState] = useState(getOrder);

  const [feedStatus, setFeedStatus] = useState("");
  const [currentEpisodeId, setCurrentEpisodeId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [pendingEpisodeId, setPendingEpisodeId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const connIdRef = useRef("conn-" + Math.random().toString(36).slice(2, 11));
  const syncTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendWS = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connectWS = useCallback(() => {
    if (!accountId) return;

    const protocol = window.location.protocol === "https" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({ type: "auth", accountId, connId: connIdRef.current })
      );
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WSMessage;

        if (msg.type === "connected") {
          connIdRef.current = msg.connId ?? connIdRef.current;
          return;
        }

        if (msg.type !== "state") return;

        setIsActive(msg.activeConnId === connIdRef.current);

        if (msg.isPlaying !== undefined) {
          setIsPlaying(msg.isPlaying);
        }

        if (msg.episodeId && msg.episodeId !== currentEpisodeId) {
          setCurrentEpisodeId(msg.episodeId);

          if (episodes.length === 0 && rssUrl) {
            setPendingEpisodeId(msg.episodeId);
            fetchRSS(rssUrl)
              .then(parseFeed)
              .then((f) => setEpisodesState(f.episodes))
              .catch(() => {
                fetchRSSProxy(rssUrl)
                  .then(parseFeed)
                  .then((f) => setEpisodesState(f.episodes));
              });
          } else if (episodes.length > 0) {
            const ep = episodes.find((e) => e.id === msg.episodeId);
            if (ep) {
              audioRef.current!.src = ep.audioUrl;
            }
          }
        }

        if (msg.positionSec !== undefined && isActive) {
          const audio = audioRef.current;
          if (audio && Math.abs(audio.currentTime - msg.positionSec) > 2) {
            audio.currentTime = msg.positionSec;
          }
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWS, 3000);
    };
  }, [accountId, currentEpisodeId, episodes, rssUrl, isActive]);

  useEffect(() => {
    if (!accountId) return;
    connectWS();

    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onPlay = () => {
      setIsPlaying(true);
      startSyncTimer();
    };
    const onPause = () => {
      setIsPlaying(false);
      stopSyncTimer();
      sendWS({
        type: "sync",
        episodeId: currentEpisodeId,
        positionSec: audio.currentTime,
        isPlaying: false,
      });
    };
    const onEnded = () => {
      setIsPlaying(false);
      stopSyncTimer();
      sendWS({
        type: "sync",
        episodeId: currentEpisodeId,
        positionSec: audio.currentTime,
        isPlaying: false,
      });
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      wsRef.current?.close();
      stopSyncTimer();
    };
  }, [accountId, connectWS, currentEpisodeId, sendWS]);

  useEffect(() => {
    if (pendingEpisodeId && episodes.length > 0) {
      const ep = episodes.find((e) => e.id === pendingEpisodeId);
      if (ep) audioRef.current!.src = ep.audioUrl;
      setPendingEpisodeId(null);
    }
  }, [pendingEpisodeId, episodes]);

  const startSyncTimer = useCallback(() => {
    stopSyncTimer();
    syncTimer.current = setInterval(() => {
      const audio = audioRef.current;
      if (audio && isActive && currentEpisodeId) {
        sendWS({
          type: "sync",
          episodeId: currentEpisodeId,
          positionSec: audio.currentTime,
          isPlaying: true,
        });
      }
    }, SYNC_INTERVAL);
  }, [isActive, currentEpisodeId, sendWS]);

  const stopSyncTimer = useCallback(() => {
    if (syncTimer.current) {
      clearInterval(syncTimer.current);
      syncTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (accountId) {
      fetchState(accountId).then((data) => {
        if (data.account?.rssUrl) {
          setRssUrlState(data.account.rssUrl);
          setRssUrl(data.account.rssUrl);
        }
        if (data.account?.orderDir) {
          setOrderState(data.account.orderDir);
          setOrder(data.account.orderDir);
        }
      });
    }
  }, [accountId]);

  const createAccount = useCallback(() => {
    const id = "acc-" + crypto.randomUUID().slice(0, 8);
    setAccountId(id);
    setAccountIdState(id);
  }, []);

  const joinAccount = useCallback((id: string) => {
    setAccountId(id);
    setAccountIdState(id);
  }, []);

  const logout = useCallback(() => {
    clearAccount();
    setAccountIdState("");
    setRssUrlState("");
    setEpisodesState([]);
    setOrderState("old-to-new");
  }, []);

  const loadFeed = useCallback(
    async (url: string) => {
      setFeedStatus("Fetching feed...");
      try {
        const text = await fetchRSS(url);
        const feed = parseFeed(text);
        setRssUrl(url);
        setRssUrlState(url);
        setEpisodes(feed.episodes);
        setEpisodesState(feed.episodes);
        setFeedStatus(
          `Loaded ${feed.episodes.length} episodes from "${feed.title}"`
        );
        await saveFeed(accountId, url, order);
      } catch {
        try {
          const text = await fetchRSSProxy(url);
          const feed = parseFeed(text);
          setRssUrl(url);
          setRssUrlState(url);
          setEpisodes(feed.episodes);
          setEpisodesState(feed.episodes);
          setFeedStatus(
            `Loaded ${feed.episodes.length} episodes from "${feed.title}"`
          );
          await saveFeed(accountId, url, order);
        } catch {
          setFeedStatus("Failed to load feed");
        }
      }
    },
    [accountId, order]
  );

  const toggleOrder = useCallback(async () => {
    const next = order === "new-to-old" ? "old-to-new" : "new-to-old";
    setOrder(next);
    setOrderState(next);
    if (rssUrl) {
      await saveFeed(accountId, rssUrl, next);
    }
  }, [accountId, order, rssUrl]);

  const takeover = useCallback(() => {
    sendWS({ type: "takeover" });
  }, [sendWS]);

  const playEpisode = useCallback(
    (id: string) => {
      const ep = episodes.find((e) => e.id === id);
      if (!ep) return;
      setCurrentEpisodeId(id);
      audioRef.current!.src = ep.audioUrl;
    },
    [episodes]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !isActive) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isActive, isPlaying]);

  const seek = useCallback((percent: number) => {
    const audio = audioRef.current;
    if (!audio?.duration) return;
    audio.currentTime = (percent / 100) * audio.duration;
  }, []);

  const handleEpisodeSelect = useCallback(
    (id: string) => {
      playEpisode(id);
      if (isActive) {
        sendWS({ type: "play", episodeId: id });
      }
    },
    [playEpisode, isActive, sendWS]
  );

  return {
    accountId,
    rssUrl,
    episodes,
    order,
    feedStatus,
    currentEpisodeId,
    isPlaying,
    currentTime,
    duration,
    isActive,
    createAccount,
    joinAccount,
    logout,
    loadFeed,
    toggleOrder,
    takeover,
    playEpisode,
    togglePlay,
    seek,
    handleEpisodeSelect,
  };
}