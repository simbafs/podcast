import { test, expect } from '@playwright/test'

test('takeover API sets active session', async ({ page, request }) => {
  await page.goto('/')

  const accountId = await page.evaluate(() => localStorage.getItem('podcast_account_id'))
  const sessionId = await page.evaluate(() => sessionStorage.getItem('podcast_session_id'))

  console.log('accountId:', accountId)
  console.log('sessionId:', sessionId)

  // First, check the initial state - should have no active session
  const initialState = await request.get(`/api/state?accountId=${accountId}&sessionId=${sessionId}`)
  const initialJson = await initialState.json()
  console.log('Initial state:', JSON.stringify(initialJson, null, 2))

  // Try to update feed without being active - should fail with 403
  const feedResult = await request.post('/api/feed', {
    data: {
      accountId: accountId,
      sessionId: sessionId,
      rssUrl: 'https://example.com/feed.xml'
    }
  })

  console.log('Feed update status:', feedResult.status())
  const feedJson = await feedResult.json()
  console.log('Feed update result:', JSON.stringify(feedJson, null, 2))
  expect(feedResult.status()).toBe(403)

  // Now call takeover to become active
  const takeoverResult = await request.post('/api/takeover', {
    data: {
      accountId: accountId,
      sessionId: sessionId
    }
  })

  console.log('Takeover status:', takeoverResult.status())
  const takeoverJson = await takeoverResult.json()
  console.log('Takeover result:', JSON.stringify(takeoverJson, null, 2))
  expect(takeoverJson.success).toBe(true)
  expect(takeoverJson.activeSessionId).toBe(sessionId)

  // Now try to update feed again - should succeed
  const feedResult2 = await request.post('/api/feed', {
    data: {
      accountId: accountId,
      sessionId: sessionId,
      rssUrl: 'https://example.com/feed.xml'
    }
  })

  console.log('Feed update after takeover status:', feedResult2.status())
  const feedJson2 = await feedResult2.json()
  console.log('Feed update after takeover:', JSON.stringify(feedJson2, null, 2))
  expect(feedResult2.status()).toBe(200)

  // Verify state now shows active session
  const finalState = await request.get(`/api/state?accountId=${accountId}&sessionId=${sessionId}`)
  const finalJson = await finalState.json()
  console.log('Final state:', JSON.stringify(finalJson, null, 2))
  expect(finalJson.account?.activeSessionId).toBe(sessionId)
})