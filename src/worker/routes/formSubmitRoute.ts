import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { json } from "../utils";

export async function handleFormSubmitRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "POST" || url.pathname !== "/form-submit") return null;

  const authPayload = await requireAuth(request, env);
  if (!authPayload) return json({ ok: false, error: "Unauthorized" }, 401);

  try {
    const body = await request.text();
    const scriptRes = await fetch(env.FORM_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const scriptData = (await scriptRes.json()) as { ok?: boolean };
    return json({ ok: scriptData.ok ?? true });
  } catch {
    return json({ ok: false, error: "Submission failed" }, 500);
  }
}