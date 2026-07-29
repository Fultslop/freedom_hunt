import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { json } from "../utils";
import { isParticipantToken } from "../../types/auth";
import { generateVariants } from "../imageProcessing";
import { buildR2KeyPrefix, buildVariantKey, buildVideoKey } from "../photoKeys";
import { insertPhoto } from "../db";

const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

function generateId(): string {
  return crypto.randomUUID();
}

export async function handleUploadVideoRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "POST" || url.pathname !== "/upload-video") {
    return null;
  }

  const authPayload = await requireAuth(request, env);
  if (!authPayload || !isParticipantToken(authPayload)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const formData = await request.formData();
    const video = formData.get("video") as File | null;
    const poster = formData.get("poster") as File | null;
    if (!video || !poster) {
      return json({ ok: false, error: "No video provided" }, 400);
    }

    const videoBytes = new Uint8Array(await video.arrayBuffer());
    if (videoBytes.length > MAX_VIDEO_BYTES) {
      return json({ ok: false, error: "Video too large" }, 400);
    }

    const locationId = (formData.get("locationId") as string) || "unknown";
    const cityId = (formData.get("cityId") as string) || "unknown";
    const routeId = (formData.get("routeId") as string) || null;
    const taskTitle = (formData.get("taskTitle") as string) || "Untitled challenge";

    const timestamp = Date.now();
    const keyPrefix = buildR2KeyPrefix(locationId, timestamp);
    const videoMimeType = video.type || "video/webm";

    const posterBytes = new Uint8Array(await poster.arrayBuffer());
    let posterMimeType = poster.type || "image/jpeg";
    let fullBytes: Uint8Array = posterBytes;
    let mediumBytes: Uint8Array | null = null;
    let thumbBytes: Uint8Array | null = null;

    try {
      const variants = generateVariants(posterBytes, posterMimeType);
      fullBytes = variants.full;
      mediumBytes = variants.medium;
      thumbBytes = variants.thumb;
      posterMimeType = variants.mimeType;
    } catch {
      // Corrupt poster or unsupported format — fall back to storing the raw
      // poster as the "full" variant only, same fallback uploadRoute.ts uses.
    }

    await env.PHOTOS.put(buildVariantKey(keyPrefix, "full"), fullBytes, {
      httpMetadata: { contentType: posterMimeType },
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
    await env.PHOTOS.put(buildVideoKey(keyPrefix, videoMimeType), videoBytes, {
      httpMetadata: { contentType: videoMimeType },
    });

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
      mime_type: videoMimeType,
      uploaded_at: Math.floor(timestamp / 1000),
      kind: "video",
    });

    return json({ ok: true, id: photoId, key: keyPrefix });
  } catch {
    return json({ ok: false, error: "Upload failed" }, 500);
  }
}
