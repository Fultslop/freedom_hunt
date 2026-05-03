import { handleAuthRoutes } from './worker/routes/authRoutes.js'
import { handleUploadRoute } from './worker/routes/uploadRoute.js'
import { handleFormSubmitRoute } from './worker/routes/formSubmitRoute.js'
import { handleEditorRoutes } from './worker/routes/editorRoutes.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    return (
      await handleAuthRoutes(request, url, env) ??
      await handleUploadRoute(request, url, env) ??
      await handleFormSubmitRoute(request, url, env) ??
      await handleEditorRoutes(request, url, env) ??
      (env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 }))
    )
  },
}