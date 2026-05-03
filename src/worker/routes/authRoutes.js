import { checkRateLimit, createToken, requireAuth, COOKIE_NAME, TOKEN_TTL_SECONDS, AUTH_COOKIE_ATTRS, KV_PREFIX_ADMIN, KV_PREFIX_PARTICIPANT } from '../auth.js'
import { json } from '../utils.js'

export async function handleAuthRoutes(request, url, env) {
  if (request.method === 'POST' && url.pathname === '/auth/login') {
    try {
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
      if (await checkRateLimit(clientIP, env)) {
        return json({ ok: false, error: 'Too many attempts. Please wait a moment.' }, 429)
      }
      const { project, teamName, contact, password } = await request.json()
      if (!project || !password) return json({ ok: false, error: 'Missing required fields' }, 400)

      const adminPw = await env.AUTH_STORE.get(`${KV_PREFIX_ADMIN}${project}`)
      const participantPw = await env.AUTH_STORE.get(`${KV_PREFIX_PARTICIPANT}${project}`)
      if (adminPw === null && participantPw === null) {
        return json({ ok: false, error: 'Project not found' }, 401)
      }

      let isAdmin = false
      if (adminPw !== null && password === adminPw) {
        isAdmin = true
      } else if (participantPw === null || password !== participantPw) {
        return json({ ok: false, error: 'Incorrect password' }, 401)
      }

      const payload = {
        project,
        teamName: teamName || '',
        contact: contact || '',
        isAdmin,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      }
      const token = await createToken(payload, env.AUTH_SECRET)
      return json(
        { ok: true, teamName: payload.teamName, contact: payload.contact, isAdmin },
        200,
        { 'Set-Cookie': `${COOKIE_NAME}=${token}; ${AUTH_COOKIE_ATTRS}; Max-Age=${TOKEN_TTL_SECONDS}` }
      )
    } catch {
      return json({ ok: false, error: 'Login failed' }, 500)
    }
  }

  if (request.method === 'GET' && url.pathname === '/auth/me') {
    const payload = await requireAuth(request, env)
    if (!payload) return json({ ok: false, error: 'Not authenticated' }, 401)
    return json({
      ok: true,
      project: payload.project,
      teamName: payload.teamName,
      contact: payload.contact,
      isAdmin: payload.isAdmin ?? false,
    })
  }

  if (request.method === 'POST' && url.pathname === '/auth/logout') {
    return json(
      { ok: true },
      200,
      { 'Set-Cookie': `${COOKIE_NAME}=; ${AUTH_COOKIE_ATTRS}; Max-Age=0` }
    )
  }

  return null
}