export function buildR2Key(locationId, mimeType, timestamp) {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  return `${locationId}_${timestamp}.${ext}`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const formData = await request.formData()
        const photo = formData.get('photo')
        const locationId = formData.get('locationId') || 'unknown'
        const key = buildR2Key(locationId, photo.type, Date.now())
        await env.PHOTOS.put(key, photo.stream(), {
          httpMetadata: { contentType: photo.type },
        })
        return new Response(JSON.stringify({ ok: true, key }), {
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Upload failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    if (!env.ASSETS) {
      return new Response('Not found', { status: 404 })
    }
    return env.ASSETS.fetch(request)
  },
}