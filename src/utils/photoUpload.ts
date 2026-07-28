// Matches the server's FULL_MAX_DIMENSION in src/worker/imageProcessing.ts —
// no point sending pixels the server would immediately downscale away.
const UPLOAD_MAX_DIMENSION = 2048;
const UPLOAD_QUALITY = 0.92;

/**
 * Re-encodes `file` as JPEG using the browser's own image decoder before
 * upload. Phones commonly hand the camera-capture input a format (e.g. HEIC
 * on iPhones with the default camera setting) that the server's image
 * pipeline can't decode; when server-side decoding fails, only the raw
 * upload is stored and the resized thumb/medium variants are silently
 * skipped, leaving the gallery showing broken images for those sizes.
 * Normalizing here — via the same decoder the browser already used to
 * preview the photo — guarantees the server always receives a format it
 * supports, regardless of what the camera produced.
 *
 * Decodes directly at a capped size via createImageBitmap's resize options,
 * rather than decoding full-resolution then scaling down with canvas — a
 * fresh camera photo can be 12-48MP, and materializing that as a full
 * bitmap (100MB+) before ever touching the canvas is a common way to
 * OOM-crash a mobile browser tab, silently dropping the upload before the
 * fetch is even made. Two passes (width first, then height only if still
 * over the cap) bounds both dimensions without knowing the source's
 * orientation up front, while each pass only ever holds an already-capped
 * bitmap in memory.
 */
export async function normalizePhotoForUpload(file: File): Promise<File> {
  let bitmap = await createImageBitmap(file, {
    resizeWidth: UPLOAD_MAX_DIMENSION,
    resizeQuality: "medium",
  });
  if (bitmap.height > UPLOAD_MAX_DIMENSION) {
    const capped = await createImageBitmap(bitmap, {
      resizeHeight: UPLOAD_MAX_DIMENSION,
      resizeQuality: "medium",
    });
    bitmap.close();
    bitmap = capped;
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("2D canvas context unavailable");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", UPLOAD_QUALITY);
  });
  if (!blob) {
    throw new Error("JPEG encoding failed");
  }

  const name = file.name.replace(/\.[^./]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
