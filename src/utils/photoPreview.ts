const PREVIEW_SIZE = 200;
const PREVIEW_QUALITY = 0.6;
const PREVIEW_DECODE_MAX_DIMENSION = 800;

export async function createPhotoPreview(file: File): Promise<string> {
  let bitmap = await createImageBitmap(file, {
    resizeWidth: PREVIEW_DECODE_MAX_DIMENSION,
    resizeQuality: "medium",
  });
  if (bitmap.height > PREVIEW_DECODE_MAX_DIMENSION) {
    const capped = await createImageBitmap(bitmap, {
      resizeHeight: PREVIEW_DECODE_MAX_DIMENSION,
      resizeQuality: "medium",
    });
    bitmap.close();
    bitmap = capped;
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const cropX = (bitmap.width - side) / 2;
  const cropY = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("2D canvas context unavailable");
  }
  ctx.drawImage(bitmap, cropX, cropY, side, side, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", PREVIEW_QUALITY);
}
