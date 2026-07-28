import { createPhotoPreview } from "../utils/photoPreview";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubResizingImageBitmap(nativeWidth: number, nativeHeight: number) {
  const bitmaps: Array<{ width: number; height: number; close: ReturnType<typeof vi.fn> }> = [];
  const createImageBitmap = vi.fn(
    (
      source: File | { width: number; height: number },
      options?: { resizeWidth?: number; resizeHeight?: number },
    ) => {
      const sourceWidth = source instanceof File ? nativeWidth : source.width;
      const sourceHeight = source instanceof File ? nativeHeight : source.height;
      let width = sourceWidth;
      let height = sourceHeight;
      if (options?.resizeWidth && options.resizeWidth < sourceWidth) {
        width = options.resizeWidth;
        height = Math.round(sourceHeight * (options.resizeWidth / sourceWidth));
      } else if (options?.resizeHeight && options.resizeHeight < sourceHeight) {
        height = options.resizeHeight;
        width = Math.round(sourceWidth * (options.resizeHeight / sourceHeight));
      }
      const bitmap = { width, height, close: vi.fn() };
      bitmaps.push(bitmap);
      return Promise.resolve(bitmap);
    },
  );
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  return { createImageBitmap, bitmaps };
}

function stubCanvas() {
  const drawImage = vi.fn();
  const toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,FAKE");
  const fakeContext = { drawImage };
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(fakeContext),
    toDataURL,
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );
  return { drawImage, toDataURL };
}

test("never performs an uncapped decode of a large source photo", async () => {
  stubCanvas();
  const { createImageBitmap } = stubResizingImageBitmap(8000, 6000);

  const file = new File(["data"], "photo.heic", { type: "image/heic" });
  await createPhotoPreview(file);

  for (const call of createImageBitmap.mock.calls) {
    const options = call[1] as { resizeWidth?: number; resizeHeight?: number } | undefined;
    expect(options?.resizeWidth || options?.resizeHeight).toBeTruthy();
  }
});

test("still crops correctly after a capped decode of a very large landscape photo", async () => {
  const { drawImage } = stubCanvas();
  stubResizingImageBitmap(8000, 6000);

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await createPhotoPreview(file);

  expect(drawImage).toHaveBeenCalled();
  const [, , , cropW, cropH] = drawImage.mock.calls[0];
  expect(cropW).toBe(cropH);
});

test("center-crops a wider-than-tall image to a square using the shorter side", async () => {
  const { drawImage, toDataURL } = stubCanvas();
  stubResizingImageBitmap(400, 300);

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const result = await createPhotoPreview(file);

  // 400x300 source: crop side = min(400,300) = 300, centered horizontally
  // (sx = (400-300)/2 = 50), no vertical offset (sy = 0), drawn to fill the
  // full 200x200 destination.
  expect(drawImage).toHaveBeenCalledWith(
    expect.objectContaining({ width: 400, height: 300 }),
    50, 0, 300, 300,
    0, 0, 200, 200,
  );
  expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.6);
  expect(result).toBe("data:image/jpeg;base64,FAKE");
});

test("center-crops a taller-than-wide image using the shorter side", async () => {
  const { drawImage } = stubCanvas();
  stubResizingImageBitmap(300, 500);

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await createPhotoPreview(file);

  // 300x500 source: crop side = min(300,500) = 300, no horizontal offset
  // (sx = 0), centered vertically (sy = (500-300)/2 = 100).
  expect(drawImage).toHaveBeenCalledWith(
    expect.objectContaining({ width: 300, height: 500 }),
    0, 100, 300, 300,
    0, 0, 200, 200,
  );
});

test("rejects when a 2D canvas context is unavailable", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 100, height: 100, close: vi.fn() }),
  );
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(null),
    toDataURL: vi.fn(),
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await expect(createPhotoPreview(file)).rejects.toThrow(
    "2D canvas context unavailable",
  );
});
