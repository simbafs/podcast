import { test, expect } from '@playwright/test'

const RSS_URL = 'https://feeds.soundon.fm/podcasts/adf29720-e93b-4856-a09e-b73544147ec4.xml'

test('same account different sessions - state sync and takeover', async ({ browser, request }) => {
  const context1 = await browser.newContext()
  const context2 = await browser.newContext()

  const page1 = await context1.newPage()
  const page2 = await context2.newPage()

  await page1.goto('/')
  await page2.goto('/')

  const getAccountId = (page: any) => page.evaluate(() => {
    return localStorage.getItem('podcast_account_id')
  })

  const getSessionId = (page: any) => page.evaluate(() => {
    return sessionStorage.getItem('podcast_session_id')
  })

  const accountId1 = await getAccountId(page1)
  const sessionId1 = await getSessionId(page1)
  const sessionId2 = await getSessionId(page2)

  console.log(`Session 1 - account: ${accountId1?.slice(0, 8)}..., session: ${sessionId1?.slice(0, 8)}...`)
  console.log(`Session 2 - session: ${sessionId2?.slice(0, 8)}...`)

  // Session 1 loads feed and becomes active
  await page1.goto(`/?account=${accountId1}`)
  await page1.locator('#rss-url').fill(RSS_URL)
  await page1.locator('#fetch-feed-btn').click()
  await expect(page1.locator('#feed-status')).toContainText('Loaded', { timeout: 30000 })

  const episodes1 = page1.locator('#episode-list .episode-item')
  await episodes1.first().click()
  await expect(page1.locator('#now-playing-title')).not.toHaveText('Select an episode')

  const state1 = await request.get(`/api/state?accountId=${accountId1}&sessionId=${sessionId1}`)
  const state1Json = await state1.json()
  console.log('Session 1 state:', JSON.stringify(state1Json, null, 2))

  expect(state1Json.account?.activeSessionId).toBe(sessionId1)
  expect(state1Json.account?.rssUrl).toBe(RSS_URL)
  console.log('✅ Session 1 is active session with RSS URL')

  // Session 2 loads same account - should trigger automatic takeover via frontend
  await page2.goto(`/?account=${accountId1}`)
  await page2.waitForLoadState('networkidle')

  const state2 = await request.get(`/api/state?accountId=${accountId1}&sessionId=${sessionId2}`)
  const state2Json = await state2.json()
  console.log('Session 2 state:', JSON.stringify(state2Json, null, 2))

  // Session 2 should have taken over (frontend auto-triggers takeover when loading)
  expect(state2Json.account?.activeSessionId).toBe(sessionId2)
  expect(state2Json.account?.rssUrl).toBe(RSS_URL)
  console.log('✅ Session 2 automatically took over (as expected when page loads)')

  // Verify Session 1 now sees Session 2 as active
  const state1Again = await request.get(`/api/state?accountId=${accountId1}&sessionId=${sessionId1}`)
  const state1AgainJson = await state1Again.json()
  console.log('Session 1 sees after Session 2 took over:', JSON.stringify(state1AgainJson, null, 2))

  expect(state1AgainJson.account?.activeSessionId).toBe(sessionId2)
  console.log('✅ Session 1 sees Session 2 as the new active session')

  await context1.close()
  await context2.close()
})