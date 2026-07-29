export const PHOTO_VARIANTS = ["thumb", "medium", "full"] as const;
export type PhotoVariant = (typeof PHOTO_VARIANTS)[number];

/** Base R2 key prefix for one photo's variants — no extension, no leading/trailing slash. */
export function buildR2KeyPrefix(locationId: string, timestamp: number): string {
  return `${locationId}_${timestamp}`;
}

/** Full R2 object key for one variant of a photo. Always `.jpg` — the actual
 * bytes are served with an explicit Content-Type from the `photos.mime_type`
 * column, so the extension here is just a naming convention, not a content claim. */
export function buildVariantKey(prefix: string, variant: PhotoVariant): string {
  return `${prefix}/${variant}.jpg`;
}

export function buildVideoKey(prefix: string, mimeType: string): string {
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  return `${prefix}/video.${ext}`;
}
