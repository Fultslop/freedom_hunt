import { createPhotoPreview } from "../utils/photoPreview";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

test("center-crops a wider-than-tall image to a square using the shorter side", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 400, height: 300, close: vi.fn() }),
  );
  const { drawImage, toDataURL } = stubCanvas();

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
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 300, height: 500, close: vi.fn() }),
  );
  const { drawImage } = stubCanvas();

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
