import type { StateResponse } from "./types";

const API_BASE = "";

export async function fetchState(accountId: string): Promise<StateResponse> {
  const res = await fetch(`${API_BASE}/api/state?accountId=${accountId}`);
  if (!res.ok) throw new Error("Failed to fetch state");
  return res.json();
}

export async function saveFeed(
  accountId: string,
  rssUrl: string,
  orderDir: string
): Promise<void> {
  await fetch(`${API_BASE}/api/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, rssUrl, orderDir }),
  });
}

export async function updateProgress(
  accountId: string,
  episodeId: string,
  positionSec: number
): Promise<void> {
  await fetch(`${API_BASE}/api/progress`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, episodeId, positionSec }),
  });
}

export async function fetchRSS(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch RSS");
  return res.text();
}

export async function fetchRSSProxy(url: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/proxy?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error("Failed to fetch RSS via proxy");
  return res.text();
}