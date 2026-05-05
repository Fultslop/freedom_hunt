import type { Env } from "./types/worker";
import { handleAuthRoutes } from "./worker/routes/authRoutes";
import { handleUploadRoute } from "./worker/routes/uploadRoute";
import { handleFormSubmitRoute } from "./worker/routes/formSubmitRoute";
import { handleEditorRoutes } from "./worker/routes/editorRoutes";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    return (
      (await handleAuthRoutes(request, url, env)) ??
      (await handleUploadRoute(request, url, env)) ??
      (await handleFormSubmitRoute(request, url, env)) ??
      (await handleEditorRoutes(request, url, env)) ??
      (env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 }))
    );
  },
};
