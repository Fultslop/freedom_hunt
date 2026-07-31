import type { Env } from "./types/worker";
import { handleAuthRoutes } from "./worker/routes/authRoutes";
import { handleInviteRoutes } from "./worker/routes/inviteRoutes";
import { handleUploadRoute } from "./worker/routes/uploadRoute";
import { handleUploadVideoRoute } from "./worker/routes/uploadVideoRoute";
import { handleFormSubmitRoute } from "./worker/routes/formSubmitRoute";
import { handleConsentRoutes } from "./worker/routes/consentRoutes";
import { handleGalleryRoutes } from "./worker/routes/galleryRoutes";
import { handleEditorRoutes } from "./worker/routes/editorRoutes";
import { handleResultsRoutes } from "./worker/routes/resultsRoutes";

async function dispatchApiRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  return (
    (await handleAuthRoutes(request, url, env)) ??
    (await handleInviteRoutes(request, url, env)) ??
    (await handleUploadRoute(request, url, env)) ??
    (await handleUploadVideoRoute(request, url, env)) ??
    (await handleFormSubmitRoute(request, url, env)) ??
    (await handleConsentRoutes(request, url, env)) ??
    (await handleGalleryRoutes(request, url, env)) ??
    (await handleResultsRoutes(request, url, env)) ??
    (await handleEditorRoutes(request, url, env))
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log(
      `[worker] ${new Date().toISOString()} ${request.method} ${url.pathname} ` +
        `bindings: AUTH_DB=${!!env.AUTH_DB} AUTH_STORE=${!!env.AUTH_STORE} ` +
        `PHOTOS=${!!env.PHOTOS} AUTH_SECRET=${!!env.AUTH_SECRET} ASSETS=${!!env.ASSETS}`,
    );
    return (
      (await dispatchApiRoutes(request, url, env)) ??
      (env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 }))
    );
  },
};
