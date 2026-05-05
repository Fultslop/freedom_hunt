import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { json } from "../utils";

const MIME_PNG = "image/png";

export function buildR2Key(
  locationId: string,
  mimeType: string,
  timestamp: number,
): string {
  const ext = mimeType === MIME_PNG ? "png" : "jpg";
  return `${locationId}_${timestamp}.${ext}`;
}

export async function handleUploadRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "POST" || url.pathname !== "/upload") return null;

  const authPayload = await requireAuth(request, env);
  if (!authPayload) return json({ ok: false, error: "Unauthorized" }, 401);

  try {
    const formData = await request.formData();
    const photo = formData.get("photo") as File | null;
    if (!photo) return json({ ok: false, error: "No photo provided" }, 400);
    const locationId = (formData.get("locationId") as string) || "unknown";
    const key = buildR2Key(locationId, photo.type, Date.now());
    await env.PHOTOS.put(key, photo.stream(), {
      httpMetadata: { contentType: photo.type },
    });
    return json({ ok: true, key });
  } catch {
    return json({ ok: false, error: "Upload failed" }, 500);
  }
}
