interface FeedInputProps {
  rssUrl: string;
  status: string;
  onSubmit: (url: string) => void;
  onToggleOrder: () => void;
  onTakeover: () => void;
  order: string;
  isActive: boolean;
}

export function FeedInput({
  rssUrl,
  status,
  onSubmit,
  onToggleOrder,
  onTakeover,
  order,
  isActive,
}: FeedInputProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const url = new FormData(e.currentTarget).get("url") as string;
    if (url?.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          name="url"
          className="input input-bordered flex-1"
          placeholder="RSS Feed URL"
          defaultValue={rssUrl}
          required
        />
        <button type="submit" className="btn btn-primary">
          Load Feed
        </button>
      </form>
      {status && <span className="text-sm opacity-70">{status}</span>}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={onToggleOrder}
        >
          Order: {order === "new-to-old" ? "New to Old" : "Old to New"}
        </button>
        {!isActive && (
          <button
            type="button"
            className="btn btn-sm btn-warning"
            onClick={onTakeover}
          >
            Takeover
          </button>
        )}
      </div>
    </div>
  );
}