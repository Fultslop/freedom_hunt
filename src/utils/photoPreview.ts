const PREVIEW_SIZE = 200;
const PREVIEW_QUALITY = 0.6;

export async function createPhotoPreview(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const cropX = (bitmap.width - side) / 2;
  const cropY = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }
  ctx.drawImage(bitmap, cropX, cropY, side, side, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", PREVIEW_QUALITY);
}
