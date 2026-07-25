import type { Env } from "../../types/worker";
import type { DbPhoto } from "../db";
import type { GalleryPhoto } from "../../types/gallery";
import { requireAuth, requireParticipantForProject } from "../auth";
import { isParticipantToken } from "../../types/auth";
import { json } from "../utils";
import { listPhotos, randomPhotos, getPhotoById } from "../db";
import { buildVariantKey, PHOTO_VARIANTS, type PhotoVariant } from "../photoKeys";

const RANDOM_SAMPLE_SIZE = 12;

function toGalleryPhoto(photo: DbPhoto): GalleryPhoto {
  return {
    id: photo.id,
    locationId: photo.location_id,
    taskTitle: photo.task_title,
    teamName: photo.team_name,
    uploadedAt: photo.uploaded_at,
    thumbUrl: `/photos/${photo.id}/thumb`,
    mediumUrl: `/photos/${photo.id}/medium`,
    fullUrl: `/photos/${photo.id}/full`,
  };
}

export async function handleGalleryRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "GET") {
    return null;
  }

  const randomMatch = url.pathname.match(/^\/gallery\/([^/]+)\/([^/]+)\/photos\/random$/);
  const listMatch = url.pathname.match(/^\/gallery\/([^/]+)\/([^/]+)\/photos$/);
  const photoMatch = url.pathname.match(/^\/photos\/([^/]+)\/([^/]+)$/);

  if (randomMatch) {
    const [, project, city] = randomMatch;
    const authPayload = await requireParticipantForProject(request, env, project);
    if (!authPayload) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    const photos = await randomPhotos(env.AUTH_DB, project, city, RANDOM_SAMPLE_SIZE);
    return json({ ok: true, photos: photos.map(toGalleryPhoto) });
  }

  if (listMatch) {
    const [, project, city] = listMatch;
    const authPayload = await requireParticipantForProject(request, env, project);
    if (!authPayload) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    let photos = await listPhotos(env.AUTH_DB, project, city);
    const team = url.searchParams.get("team");
    const task = url.searchParams.get("task");
    if (team) {
      photos = photos.filter((photo) => photo.team_name === team);
    }
    if (task) {
      photos = photos.filter((photo) => photo.task_title === task);
    }
    return json({ ok: true, photos: photos.map(toGalleryPhoto) });
  }

  if (photoMatch) {
    const authPayload = await requireAuth(request, env);
    if (!authPayload) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const [, id, variantParam] = photoMatch;
    if (!(PHOTO_VARIANTS as readonly string[]).includes(variantParam)) {
      return json({ ok: false, error: "Unknown variant" }, 400);
    }
    const variant = variantParam as PhotoVariant;
    const photo = await getPhotoById(env.AUTH_DB, id);
    if (!photo) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    if (!isParticipantToken(authPayload) || authPayload.project !== photo.project_id) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    const key = buildVariantKey(photo.r2_key, variant);
    const object = await env.PHOTOS.get(key);
    if (!object) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    const contentType = variant === "full" ? photo.mime_type : "image/jpeg";
    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  return null;
}
