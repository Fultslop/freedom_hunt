import { requireAuth } from '../auth.js'
import { json } from '../utils.js'

export async function handleFormSubmitRoute(request, url, env) {
  if (request.method !== 'POST' || url.pathname !== '/form-submit') return null

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