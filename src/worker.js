function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(str) {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
}

export async function createToken(payload, secret) {
  const encoded = b64urlEncode(JSON.stringify(payload))
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(encoded))
  const sigB64 = b64urlEncode(String.fromCharCode(...new Uint8Array(sig)))
  return `${encoded}.${sigB64}`
}

export async function verifyToken(token, secret) {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const encoded = token.slice(0, dot)
    const sigB64 = token.slice(dot + 1)
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )
    const sigBytes = Uint8Array.from(b64urlDecode(sigB64), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(encoded))
    if (!valid) return null
    const payload = JSON.parse(b64urlDecode(encoded))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

async function checkRateLimit(ip, env) {
  const key = `rl:${ip}`
  const raw = await env.AUTH_STORE.get(key)
  const now = Date.now()
  let record = raw ? JSON.parse(raw) : { count: 0, windowStart: now }
  if (now - record.windowStart > 60000) {
    record = { count: 0, windowStart: now }
  }
  record.count++
  await env.AUTH_STORE.put(key, JSON.stringify(record), { expirationTtl: 60 })
  return record.count > 5
}

async function requireAuth(request, env) {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/(?:^|;\s*)freedom_hunt_auth=([^;]+)/)
  if (!match) return null
  return verifyToken(match[1], env.AUTH_SECRET)
}

export function buildR2Key(locationId, mimeType, timestamp) {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  return `${locationId}_${timestamp}.${ext}`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      try {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
        const rateLimited = await checkRateLimit(clientIP, env)
        if (rateLimited) {
          return json({ ok: false, error: 'Too many attempts. Please wait a moment.' }, 429)
        }
        const { project, teamName, contact, password } = await request.json()
        if (!project || !password) {
          return json({ ok: false, error: 'Missing required fields' }, 400)
        }
        const stored = await env.AUTH_STORE.get(`auth:${project}`)
        if (stored === null) {
          return json({ ok: false, error: 'Project not found' }, 401)
        }
        if (password !== stored) {
          return json({ ok: false, error: 'Incorrect password' }, 401)
        }
        const payload = {
          project,
          teamName: teamName || '',
          contact: contact || '',
          exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
        }
        const token = await createToken(payload, env.AUTH_SECRET)
        return json(
          { ok: true, teamName: payload.teamName, contact: payload.contact },
          200,
          { 'Set-Cookie': `freedom_hunt_auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000` }
        )
      } catch {
        return json({ ok: false, error: 'Login failed' }, 500)
      }
    }

    if (request.method === 'GET' && url.pathname === '/auth/me') {
      const payload = await requireAuth(request, env)
      if (!payload) return json({ ok: false, error: 'Not authenticated' }, 401)
      return json({ ok: true, project: payload.project, teamName: payload.teamName, contact: payload.contact })
    }

    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      return json(
        { ok: true },
        200,
        { 'Set-Cookie': 'freedom_hunt_auth=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' }
      )
    }

    if (request.method === 'POST' && url.pathname === '/upload') {
      const authPayload = await requireAuth(request, env)
      if (!authPayload) return json({ ok: false, error: 'Unauthorized' }, 401)
      try {
        const formData = await request.formData()
        const photo = formData.get('photo')
        const locationId = formData.get('locationId') || 'unknown'
        const key = buildR2Key(locationId, photo.type, Date.now())
        await env.PHOTOS.put(key, photo.stream(), {
          httpMetadata: { contentType: photo.type },
        })
        return json({ ok: true, key })
      } catch {
        return json({ ok: false, error: 'Upload failed' }, 500)
      }
    }

    if (request.method === 'POST' && url.pathname === '/form-submit') {
      const authPayload = await requireAuth(request, env)
      if (!authPayload) return json({ ok: false, error: 'Unauthorized' }, 401)
      try {
        const body = await request.text()
        const scriptRes = await fetch(env.FORM_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        const scriptData = await scriptRes.json()
        return json({ ok: scriptData.ok ?? true })
      } catch {
        return json({ ok: false, error: 'Submission failed' }, 500)
      }
    }

    if (!env.ASSETS) {
      return new Response('Not found', { status: 404 })
    }
    return env.ASSETS.fetch(request)
  },
}