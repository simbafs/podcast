import type { Episode, Feed } from "./types";

export function parseFeed(xmlText: string): Feed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const channel = doc.querySelector("channel");
  if (!channel) throw new Error("Invalid RSS feed");

  const title = channel.querySelector("title")?.textContent || "Unknown";
  const items = Array.from(channel.querySelectorAll("item"));

  const episodes: Episode[] = items
    .map((item, idx) => {
      const enclosure = item.querySelector("enclosure");
      const audioUrl = enclosure?.getAttribute("url") || "";
      const pubDate = item.querySelector("pubDate")?.textContent;
      const pubDateMs = pubDate ? new Date(pubDate).getTime() : 0;

      return {
        id: `ep-${idx}-${hashCode(audioUrl)}`,
        title: item.querySelector("title")?.textContent || "Untitled",
        audioUrl,
        duration: parseDuration(
          item.querySelector("itunes\\:duration")?.textContent || "0"
        ),
        pubDate: pubDateMs,
      };
    })
    .filter((e) => e.audioUrl);

  return { title, episodes };
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

function parseDuration(dur: string): number {
  if (!dur) return 0;
  if (/^\d+$/.test(dur)) return parseInt(dur, 10);
  const parts = dur.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}