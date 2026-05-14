import { test, expect } from '@playwright/test'

const RSS_URL = 'https://feeds.soundon.fm/podcasts/adf29720-e93b-4856-a09e-b73544147ec4.xml'

test('load RSS feed and verify episodes', async ({ page }) => {
  await page.goto('/')

  const rssInput = page.locator('#rss-url')
  const fetchBtn = page.locator('#fetch-feed-btn')
  const statusEl = page.locator('#feed-status')
  const episodeList = page.locator('#episode-list')

  await rssInput.fill(RSS_URL)
  await fetchBtn.click()

  await expect(statusEl).toContainText('Fetching feed...', { timeout: 15000 })

  await expect(statusEl).toContainText('Loaded', { timeout: 30000 })

  const episodes = episodeList.locator('.episode-item')
  const count = await episodes.count()

  expect(count).toBeGreaterThan(0)

  const firstEpisode = episodes.first()
  await expect(firstEpisode).toBeVisible()

  const title = await firstEpisode.locator('.episode-title').textContent()
  expect(title).toBeTruthy()
  console.log(`Loaded ${count} episodes. First episode: ${title}`)
})

test('verify account session handling', async ({ page }) => {
  await page.goto('/')

  const badge = page.locator('#device-badge')
  await expect(badge).toBeVisible()

  const badgeText = await badge.textContent()
  expect(badgeText).toMatch(/^[a-f0-9]+ \(/)

  console.log(`Session: ${badgeText}`)
})

test('click episode and verify playback starts', async ({ page }) => {
  await page.goto('/')

  const rssInput = page.locator('#rss-url')
  const fetchBtn = page.locator('#fetch-feed-btn')

  await rssInput.fill(RSS_URL)
  await fetchBtn.click()

  await expect(page.locator('#feed-status')).toContainText('Loaded', { timeout: 30000 })

  const episodeList = page.locator('#episode-list')
  const firstEpisode = episodeList.locator('.episode-item').first()

  await firstEpisode.click()

  const nowPlaying = page.locator('#now-playing-title')
  await expect(nowPlaying).not.toHaveText('Select an episode')

  const episodeTitle = await nowPlaying.textContent()
  console.log(`Now playing: ${episodeTitle}`)
})