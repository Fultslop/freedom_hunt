import { normalizePhotoForUpload } from "../utils/photoUpload";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubCanvas(blob: Blob | null = new Blob(["jpeg-bytes"], { type: "image/jpeg" })) {
  const drawImage = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback) => callback(blob));
  const fakeContext = { drawImage };
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(fakeContext),
    toBlob,
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );
  return { drawImage, toBlob, fakeCanvas };
}

interface FakeBitmap {
  width: number;
  height: number;
  close: ReturnType<typeof vi.fn>;
}

/**
 * Mimics real createImageBitmap resize semantics closely enough to test
 * against: resizeWidth/resizeHeight scale the source (a File on the first
 * call, or a previously-returned fake bitmap on a chained call) preserving
 * aspect ratio from whichever dimension was specified.
 */
function stubResizingImageBitmap(nativeWidth: number, nativeHeight: number) {
  const bitmaps: FakeBitmap[] = [];
  const createImageBitmap = vi.fn(
    (
      source: File | FakeBitmap,
      options?: { resizeWidth?: number; resizeHeight?: number },
    ): Promise<FakeBitmap> => {
      const sourceWidth = source instanceof File ? nativeWidth : source.width;
      const sourceHeight = source instanceof File ? nativeHeight : source.height;
      let width = sourceWidth;
      let height = sourceHeight;
      if (options?.resizeWidth) {
        width = options.resizeWidth;
        height = Math.round(sourceHeight * (options.resizeWidth / sourceWidth));
      } else if (options?.resizeHeight) {
        height = options.resizeHeight;
        width = Math.round(sourceWidth * (options.resizeHeight / sourceHeight));
      }
      const bitmap: FakeBitmap = { width, height, close: vi.fn() };
      bitmaps.push(bitmap);
      return Promise.resolve(bitmap);
    },
  );
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  return { createImageBitmap, bitmaps };
}

test("re-encodes a HEIC photo as a JPEG File", async () => {
  stubCanvas();
  stubResizingImageBitmap(4000, 3000);

  const file = new File(["heic-bytes"], "IMG_0001.HEIC", { type: "image/heic" });
  const result = await normalizePhotoForUpload(file);

  expect(result).toBeInstanceOf(File);
  expect(result.type).toBe("image/jpeg");
  expect(result.name).toBe("IMG_0001.jpg");
});

test("landscape photo: a single width-capped decode is enough (never materializes full resolution)", async () => {
  const { fakeCanvas } = stubCanvas();
  const { createImageBitmap } = stubResizingImageBitmap(4000, 3000);

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await normalizePhotoForUpload(file);

  expect(createImageBitmap).toHaveBeenCalledTimes(1);
  expect(createImageBitmap).toHaveBeenCalledWith(
    file,
    expect.objectContaining({ resizeWidth: 2048 }),
  );
  expect(fakeCanvas.width).toBe(2048);
  expect(fakeCanvas.height).toBe(1536);
});

test("portrait photo: needs a second height-capped decode, chained off the first (still-capped) bitmap", async () => {
  const { fakeCanvas } = stubCanvas();
  const { createImageBitmap, bitmaps } = stubResizingImageBitmap(3000, 4000);

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await normalizePhotoForUpload(file);

  expect(createImageBitmap).toHaveBeenCalledTimes(2);
  expect(createImageBitmap).toHaveBeenNthCalledWith(
    1,
    file,
    expect.objectContaining({ resizeWidth: 2048 }),
  );
  // Second call resizes the already-shrunk first bitmap, not the raw file —
  // this is what keeps peak memory bounded for very large portrait photos.
  expect(createImageBitmap).toHaveBeenNthCalledWith(
    2,
    bitmaps[0],
    expect.objectContaining({ resizeHeight: 2048 }),
  );
  expect(fakeCanvas.width).toBe(1536);
  expect(fakeCanvas.height).toBe(2048);
});

test("closes every intermediate bitmap, including the one dropped after the second decode pass", async () => {
  stubCanvas();
  const { bitmaps } = stubResizingImageBitmap(3000, 4000);

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await normalizePhotoForUpload(file);

  expect(bitmaps).toHaveLength(2);
  expect(bitmaps[0].close).toHaveBeenCalled();
  expect(bitmaps[1].close).toHaveBeenCalled();
});

test("rejects when a 2D canvas context is unavailable", async () => {
  stubResizingImageBitmap(100, 100);
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(null),
    toBlob: vi.fn(),
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    fakeCanvas as unknown as HTMLCanvasElement,
  );

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await expect(normalizePhotoForUpload(file)).rejects.toThrow(
    "2D canvas context unavailable",
  );
});

test("rejects when JPEG encoding produces no blob", async () => {
  stubCanvas(null);
  stubResizingImageBitmap(100, 100);

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await expect(normalizePhotoForUpload(file)).rejects.toThrow(
    "JPEG encoding failed",
  );
});
