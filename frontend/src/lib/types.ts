export interface Episode {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  pubDate: number;
}

export interface Feed {
  title: string;
  episodes: Episode[];
}

export interface AccountState {
  rssUrl: string;
  orderDir: string;
  currentEpisodeId: string;
  positionSec: number;
  isPlaying: boolean;
}

export interface StateResponse {
  account: AccountState;
  progress: Record<string, { positionSec: number }>;
}

export interface WSMessage {
  type: string;
  activeConnId?: string;
  episodeId?: string;
  positionSec?: number;
  isPlaying?: boolean;
  message?: string;
  connId?: string;
}