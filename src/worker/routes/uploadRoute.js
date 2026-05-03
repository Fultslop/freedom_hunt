import { requireAuth } from '../auth.js'
import { json } from '../utils.js'

const MIME_PNG = 'image/png'

export function buildR2Key(locationId, mimeType, timestamp) {
  const ext = mimeType === MIME_PNG ? 'png' : 'jpg'
  return `${locationId}_${timestamp}.${ext}`
}

export async function handleUploadRoute(request, url, env) {
  if (request.method !== 'POST' || url.pathname !== '/upload') return null

  const authPayload = await requireAuth(request, env)
  if (!authPayload) return json({ ok: false, error: 'Unauthorized' }, 401)

  try {
    const formData = await request.formData()
    const photo = formData.get('photo')
    const locationId = formData.get('locationId') || 'unknown'
    const key = buildR2Key(locationId, photo.type, Date.now())
    await env.PHOTOS.put(key, photo.stream(), { httpMetadata: { contentType: photo.type } })
    return json({ ok: true, key })
  } catch {
    return json({ ok: false, error: 'Upload failed' }, 500)
  }
}