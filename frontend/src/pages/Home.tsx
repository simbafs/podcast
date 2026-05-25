import { useCallback } from "react";
import { useApp } from "../hooks/useApp";
import { EpisodeList } from "../components/EpisodeList";
import { PlayerBar } from "../components/PlayerBar";
import { FeedInput } from "../components/FeedInput";

export function Home() {
  const {
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
    loadFeed,
    toggleOrder,
    takeover,
    handleEpisodeSelect,
    togglePlay,
    seek,
    logout,
  } = useApp();

  const handleFeedSubmit = useCallback(
    (url: string) => {
      loadFeed(url);
    },
    [loadFeed]
  );

  const currentEpisode = episodes.find((e) => e.id === currentEpisodeId);

  return (
    <div className="min-h-screen bg-base-100 text-base-content flex flex-col">
      <header className="navbar bg-base-200">
        <div className="flex-1">
          <span className="btn btn-ghost normal-case text-xl">Podcast Sync</span>
        </div>
        <div className="flex-none">
          <span className="text-sm opacity-60 mr-4">
            {accountId.slice(0, 8)}...
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <FeedInput
          rssUrl={rssUrl}
          status={feedStatus}
          onSubmit={handleFeedSubmit}
          onToggleOrder={toggleOrder}
          onTakeover={takeover}
          order={order}
          isActive={isActive}
        />

        {episodes.length > 0 ? (
          <EpisodeList
            episodes={episodes}
            currentEpisodeId={currentEpisodeId}
            order={order}
            onSelect={handleEpisodeSelect}
          />
        ) : (
          <div className="p-4 text-center opacity-50">
            Enter RSS URL to load episodes
          </div>
        )}
      </main>

      <PlayerBar
        currentEpisodeTitle={currentEpisode?.title ?? "No episode"}
        isPlaying={isPlaying}
        isActive={isActive}
        currentTime={currentTime}
        duration={duration}
        onToggle={togglePlay}
        onSeek={seek}
      />
    </div>
  );
}