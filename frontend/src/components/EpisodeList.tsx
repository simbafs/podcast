import type { Episode } from "../lib/types";

interface EpisodeListProps {
  episodes: Episode[];
  currentEpisodeId: string;
  order: string;
  onSelect: (id: string) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function EpisodeList({
  episodes,
  currentEpisodeId,
  order,
  onSelect,
}: EpisodeListProps) {
  const sorted = [...episodes].sort((a, b) =>
    order === "new-to-new"
      ? (b.pubDate || 0) - (a.pubDate || 0)
      : (a.pubDate || 0) - (b.pubDate || 0)
  );

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((ep) => (
        <button
          key={ep.id}
          type="button"
          className={`btn flex-col items-start p-3 rounded-lg transition-colors ${
            ep.id === currentEpisodeId
              ? "btn-primary"
              : "btn-ghost"
          }`}
          onClick={() => onSelect(ep.id)}
        >
          <span
            className="font-medium text-left truncate w-full"
            dangerouslySetInnerHTML={{ __html: escapeHtml(ep.title) }}
          />
          <span className="text-xs opacity-60">{formatTime(ep.duration)}</span>
        </button>
      ))}
    </div>
  );
}