import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { json } from "../utils";
import { isParticipantToken } from "../../types/auth";
import { generateVariants } from "../imageProcessing";
import { buildR2KeyPrefix, buildVariantKey } from "../photoKeys";
import { insertPhoto } from "../db";

function generateId(): string {
  return crypto.randomUUID();
}

export async function handleUploadRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "POST" || url.pathname !== "/upload") {
    return null;
  }

  // No project to check against here (project always comes from the token
  // itself, per requireParticipantForProject's contract, but this route has
  // nothing else to compare it to) — requireAuth + isParticipantToken is correct as-is.
  const authPayload = await requireAuth(request, env);
  if (!authPayload || !isParticipantToken(authPayload)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const formData = await request.formData();
    const photo = formData.get("photo") as File | null;
    if (!photo) {
      return json({ ok: false, error: "No photo provided" }, 400);
    }
    const locationId = (formData.get("locationId") as string) || "unknown";
    const cityId = (formData.get("cityId") as string) || "unknown";
    const routeId = (formData.get("routeId") as string) || null;
    const taskTitle = (formData.get("taskTitle") as string) || "Untitled challenge";

    const originalBytes = new Uint8Array(await photo.arrayBuffer());
    const timestamp = Date.now();
    const keyPrefix = buildR2KeyPrefix(locationId, timestamp);

    let mimeType = photo.type || "image/jpeg";
    let fullBytes: Uint8Array = originalBytes;
    let mediumBytes: Uint8Array | null = null;
    let thumbBytes: Uint8Array | null = null;

    try {
      const variants = generateVariants(originalBytes, mimeType);
      fullBytes = variants.full;
      mediumBytes = variants.medium;
      thumbBytes = variants.thumb;
      mimeType = variants.mimeType;
    } catch {
      // Corrupt file or unsupported format — fall back to storing the raw
      // upload as the "full" variant only; the photos row is still written.
    }

    await env.PHOTOS.put(buildVariantKey(keyPrefix, "full"), fullBytes, {
      httpMetadata: { contentType: mimeType },
    });
    if (mediumBytes) {
      await env.PHOTOS.put(buildVariantKey(keyPrefix, "medium"), mediumBytes, {
        httpMetadata: { contentType: "image/jpeg" },
      });
    }
    if (thumbBytes) {
      await env.PHOTOS.put(buildVariantKey(keyPrefix, "thumb"), thumbBytes, {
        httpMetadata: { contentType: "image/jpeg" },
      });
    }

    const photoId = generateId();
    await insertPhoto(env.AUTH_DB, {
      id: photoId,
      project_id: authPayload.project,
      city_id: cityId,
      route_id: routeId,
      location_id: locationId,
      task_title: taskTitle,
      team_name: authPayload.teamName,
      contact: authPayload.contact || null,
      r2_key: keyPrefix,
      mime_type: mimeType,
      uploaded_at: Math.floor(timestamp / 1000),
    });

    return json({ ok: true, id: photoId, key: keyPrefix });
  } catch {
    return json({ ok: false, error: "Upload failed" }, 500);
  }
}
