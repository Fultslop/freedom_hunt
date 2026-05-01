import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import worker, { buildR2Key, createToken } from '../worker.js'

const TEST_SECRET = 'test-secret'
const TEST_PAYLOAD = { project: 'test_project', teamName: 'Team A', contact: 'a@b.com', exp: Math.floor(Date.now() / 1000) + 3600 }

let authToken
beforeEach(async () => {
  authToken = await createToken(TEST_PAYLOAD, TEST_SECRET)
})

describe('buildR2Key', () => {
  it('uses jpg extension for jpeg mime type', () => {
    expect(buildR2Key('001', 'image/jpeg', 1000000)).toBe('001_1000000.jpg')
  })

  it('uses png extension for png mime type', () => {
    expect(buildR2Key('001', 'image/png', 1000000)).toBe('001_1000000.png')
  })

  it('falls back to jpg for unknown mime type', () => {
    expect(buildR2Key('001', 'image/webp', 1000000)).toBe('001_1000000.jpg')
  })
})

describe('/form-submit', () => {
  afterEach(() => vi.restoreAllMocks())

  it('forwards payload to FORM_SCRIPT_URL and returns ok', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })))
    const env = {
      FORM_SCRIPT_URL: 'https://script.google.com/fake',
      AUTH_STORE: { get: async () => null },
      AUTH_SECRET: TEST_SECRET,
    }
    const body = JSON.stringify({ locationId: '001', timestamp: '2026-01-01T00:00:00Z', submitterId: 'Alice', fields: {} })
    const request = new Request('https://example.com/form-submit', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json', Cookie: `freedom_hunt_auth=${authToken}` },
    })

    const response = await worker.fetch(request, env)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://script.google.com/fake',
      expect.objectContaining({ method: 'POST', body })
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
  })

  it('propagates ok:false from Apps Script response', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: false, error: 'Sheet error' }), {
      headers: { 'Content-Type': 'application/json' },
    })))
    const env = {
      FORM_SCRIPT_URL: 'https://script.google.com/fake',
      AUTH_STORE: { get: async () => null },
      AUTH_SECRET: TEST_SECRET,
    }
    const request = new Request('https://example.com/form-submit', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    })

    const response = await worker.fetch(request, env)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(false)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    const env = {
      FORM_SCRIPT_URL: 'https://script.google.com/fake',
      AUTH_STORE: { get: async () => null },
      AUTH_SECRET: TEST_SECRET,
    }
    const request = new Request('https://example.com/form-submit', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    })

    const response = await worker.fetch(request, env)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.ok).toBe(false)
  })
})
