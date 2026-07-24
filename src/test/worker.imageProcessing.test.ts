// @ts-nocheck
import { describe, it, expect, vi } from "vitest";
import { readJpegOrientation } from "../worker/imageProcessing";

/** Builds a minimal JPEG byte sequence with a single APP1/Exif/TIFF/IFD0
 * segment containing only the Orientation tag (0x0112), little-endian. */
function buildJpegWithOrientation(orientation: number): Uint8Array {
  const tiffHeader = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]; // "II", 42, IFD0 @ offset 8
  const entryCount = [0x01, 0x00]; // 1 entry
  const entry = [
    0x12, 0x01, // tag 0x0112 (Orientation)
    0x03, 0x00, // type SHORT
    0x01, 0x00, 0x00, 0x00, // count 1
    orientation & 0xff, (orientation >> 8) & 0xff, 0x00, 0x00, // value + padding
  ];
  const nextIfdOffset = [0x00, 0x00, 0x00, 0x00];
  const tiff = [...tiffHeader, ...entryCount, ...entry, ...nextIfdOffset];

  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const app1Payload = [...exifHeader, ...tiff];
  const app1Length = app1Payload.length + 2; // includes the 2 length bytes themselves

  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe1, // APP1 marker
    (app1Length >> 8) & 0xff, app1Length & 0xff,
    ...app1Payload,
    0xff, 0xda, 0x00, 0x02, // SOS (stop scanning here)
  ]);
}

describe("readJpegOrientation", () => {
  it("returns 1 (default) for a JPEG with no EXIF segment", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]);
    expect(readJpegOrientation(bytes)).toBe(1);
  });

  it("returns 1 (default) for non-JPEG bytes", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG signature
    expect(readJpegOrientation(bytes)).toBe(1);
  });

  it("reads orientation 6 (rotated 90 CW) from an EXIF segment", () => {
    expect(readJpegOrientation(buildJpegWithOrientation(6))).toBe(6);
  });

  it("reads orientation 3 (rotated 180) from an EXIF segment", () => {
    expect(readJpegOrientation(buildJpegWithOrientation(3))).toBe(3);
  });

  it("reads orientation 8 (rotated 270 CW) from an EXIF segment", () => {
    expect(readJpegOrientation(buildJpegWithOrientation(8))).toBe(8);
  });
});

vi.mock("@cf-wasm/photon/workerd", () => {
  class FakePhotonImage {
    width: number;
    height: number;
    freed = false;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    get_width() { return this.width; }
    get_height() { return this.height; }
    get_bytes_jpeg(quality: number) {
      return new Uint8Array([this.width, this.height, Math.round(quality * 100)]);
    }
    free() { this.freed = true; }
  }
  return {
    PhotonImage: {
      new_from_byteslice: vi.fn(() => new FakePhotonImage(4000, 3000)),
    },
    resize: vi.fn((image: FakePhotonImage, width: number, height: number) =>
      new FakePhotonImage(width, height),
    ),
    rotate: vi.fn((image: FakePhotonImage, _angle: number) =>
      new FakePhotonImage(image.height, image.width),
    ),
    fliph: vi.fn(),
    flipv: vi.fn(),
    SamplingFilter: { Lanczos3: 5 },
  };
});

describe("generateVariants", () => {
  it("produces thumb/medium/full, all capped at their max long edge", async () => {
    const { generateVariants } = await import("../worker/imageProcessing");
    const result = generateVariants(new Uint8Array([0xff, 0xd8, 0xff, 0xda]), "image/jpeg");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.full).toBeInstanceOf(Uint8Array);
    expect(result.medium).toBeInstanceOf(Uint8Array);
    expect(result.thumb).toBeInstanceOf(Uint8Array);
    // FakePhotonImage encodes [width, height, quality*100] into get_bytes_jpeg output
    expect(result.full[0]).toBeLessThanOrEqual(2048);
    expect(result.medium[0]).toBeLessThanOrEqual(1200);
    expect(result.thumb[0]).toBeLessThanOrEqual(300);
  });

  it("applies a 90-degree rotate for EXIF orientation 6", async () => {
    const { generateVariants } = await import("../worker/imageProcessing");
    const photon = await import("@cf-wasm/photon/workerd");
    // Orientation 6 JPEG built the same way as in the readJpegOrientation tests
    const tiffHeader = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00];
    const entry = [0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00];
    const tiff = [...tiffHeader, 0x01, 0x00, ...entry, 0x00, 0x00, 0x00, 0x00];
    const app1Payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
    const app1Length = app1Payload.length + 2;
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff,
      ...app1Payload, 0xff, 0xda, 0x00, 0x02,
    ]);

    generateVariants(bytes, "image/jpeg");
    expect(photon.rotate).toHaveBeenCalledWith(expect.anything(), 90);
  });

  it("frees every intermediate PhotonImage", async () => {
    const { generateVariants } = await import("../worker/imageProcessing");
    const photon = await import("@cf-wasm/photon/workerd");
    const created: { freed: boolean }[] = [];
    (photon.PhotonImage.new_from_byteslice as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => {
        const img = { get_width: () => 4000, get_height: () => 3000, get_bytes_jpeg: () => new Uint8Array([1]), free: vi.fn() };
        created.push(img as unknown as { freed: boolean });
        return img;
      },
    );
    generateVariants(new Uint8Array([0xff, 0xd8, 0xff, 0xda]), "image/jpeg");
    created.forEach((img) => expect((img as unknown as { free: ReturnType<typeof vi.fn> }).free).toHaveBeenCalled());
  });
});
