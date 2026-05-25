import { useEffect, useRef, useCallback, useState } from "react";
import type { Episode, WSMessage } from "../lib/types";

const SYNC_INTERVAL = 30_000;
const SEEK_DEBOUNCE = 3_000;

interface UsePlayerOptions {
  episodes: Episode[];
  connId: React.MutableRefObject<string>;
  onState: (msg: WSMessage) => void;
  onSyncState: (episodeId: string, positionSec: number, isPlaying: boolean) => void;
}

export function usePlayer({
  episodes,
  connId,
  onState,
  onSyncState,
}: UsePlayerOptions) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateActive = useCallback(
    (activeConnId: string | undefined) => {
      setIsActive(activeConnId === connId.current);
    },
    [connId]
  );

  const playEpisode = useCallback(
    (episodeId: string) => {
      const ep = episodes.find((e) => e.id === episodeId);
      if (!ep) return;
      const audio = audioRef.current;
      if (!audio) return;

      setCurrentEpisodeId(episodeId);
      audio.src = ep.audioUrl;
    },
    [episodes]
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!isActive) return;
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

    if (seekTimer.current) clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(() => {
      if (isActive) {
        onSyncState(currentEpisodeId, audio.currentTime, isPlaying);
      }
    }, SEEK_DEBOUNCE);
  }, [isActive, currentEpisodeId, isPlaying, onSyncState]);

  const handleState = useCallback(
    (msg: WSMessage) => {
      if (msg.activeConnId) {
        updateActive(msg.activeConnId);
      }
      if (msg.isPlaying !== undefined) {
        setIsPlaying(msg.isPlaying);
      }
      if (msg.episodeId && msg.episodeId !== currentEpisodeId) {
        setCurrentEpisodeId(msg.episodeId);
      }
      if (msg.positionSec !== undefined && isActive) {
        const audio = audioRef.current;
        if (audio && Math.abs(audio.currentTime - msg.positionSec) > 2) {
          audio.currentTime = msg.positionSec;
        }
      }
      onState(msg);
    },
    [currentEpisodeId, isActive, updateActive, onState]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const onPlay = () => {
      setIsPlaying(true);
      startSyncTimer();
    };
    const onPause = () => {
      setIsPlaying(false);
      stopSyncTimer();
      onSyncState(currentEpisodeId, audio.currentTime, false);
    };
    const onEnded = () => {
      setIsPlaying(false);
      stopSyncTimer();
      onSyncState(currentEpisodeId, audio.currentTime, false);
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
    };
  }, [currentEpisodeId, onSyncState]);

  const startSyncTimer = useCallback(() => {
    stopSyncTimer();
    syncTimer.current = setInterval(() => {
      const audio = audioRef.current;
      if (audio && isActive) {
        onSyncState(currentEpisodeId, audio.currentTime, true);
      }
    }, SYNC_INTERVAL);
  }, [currentEpisodeId, isActive, onSyncState]);

  const stopSyncTimer = useCallback(() => {
    if (syncTimer.current) {
      clearInterval(syncTimer.current);
      syncTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (syncTimer.current) clearInterval(syncTimer.current);
      if (seekTimer.current) clearTimeout(seekTimer.current);
    };
  }, []);

  return {
    audioRef,
    currentEpisodeId,
    isPlaying,
    currentTime,
    duration,
    isActive,
    playEpisode,
    toggle,
    seek,
    handleState,
    setCurrentEpisodeId,
  };
}