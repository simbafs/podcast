import { Episode } from './player'
import { generateUUID } from './api'

export interface ParsedPodcast {
  title: string
  description: string
  imageUrl: string
  episodes: Episode[]
}

export async function parseFeed(url: string): Promise<ParsedPodcast> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status}`)
  }

  const text = await response.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Invalid XML format')
  }

  const channel = doc.querySelector('channel')
  if (!channel) {
    throw new Error('No channel found in feed')
  }

  const title = channel.querySelector('title')?.textContent || 'Unknown Podcast'
  const description = channel.querySelector('description')?.textContent || ''
  const imageEl = channel.querySelector('image > url') || channel.querySelector('image[href]')
  const imageUrl = imageEl?.getAttribute('href') || imageEl?.textContent || ''

  const items = channel.querySelectorAll('item')
  const episodes: Episode[] = []

  for (const item of items) {
    const epTitle = item.querySelector('title')?.textContent || 'Untitled'
    const epUrl = item.querySelector('enclosure')?.getAttribute('url') || ''

    let duration = 0
    const durationStr = item.querySelector('itunes\\:duration, duration')?.textContent
    if (durationStr) {
      duration = parseDuration(durationStr)
    }

    let pubDate: number | undefined
    const pubDateStr = item.querySelector('pubDate')?.textContent
    if (pubDateStr) {
      pubDate = new Date(pubDateStr).getTime()
    }

    if (epUrl) {
      episodes.push({
        id: generateUUID(),
        title: epTitle,
        audioUrl: epUrl,
        duration,
        pubDate,
      })
    }
  }

  episodes.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0))

  return { title, description, imageUrl, episodes }
}

function parseDuration(str: string): number {
  const parts = str.split(':').map(Number)

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 1) {
    return parts[0]
  }

  return 0
}