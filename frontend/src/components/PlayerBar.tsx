interface PlayerBarProps {
  currentEpisodeTitle: string;
  isPlaying: boolean;
  isActive: boolean;
  currentTime: number;
  duration: number;
  onToggle: () => void;
  onSeek: (percent: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function PlayerBar({
  currentEpisodeTitle,
  isPlaying,
  isActive,
  currentTime,
  duration,
  onToggle,
  onSeek,
}: PlayerBarProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="btm-nav btm-nav-lg">
      <div className="navbar bg-base-200">
        <div className="navbar-start">
          <span className="text-sm font-medium truncate max-w-xs">
            {currentEpisodeTitle || "No episode"}
          </span>
        </div>
        <div className="navbar-center">
          <div className="join">
            <button
              type="button"
              className="join-item btn btn-sm btn-square"
              onClick={onToggle}
              disabled={!isActive}
            >
              {isPlaying ? (
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="navbar-end flex gap-2 items-center">
          <span className="text-xs">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="range range-xs w-24"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => onSeek(Number(e.target.value))}
          />
          <span className="text-xs">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}