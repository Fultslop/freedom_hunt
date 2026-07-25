# Task 03: Image Processing — EXIF Orientation + Variant Generation

**Depends on:** Task 01.

**Files:**
- Create: `src/worker/photoKeys.ts`
- Create: `src/worker/imageProcessing.ts`
- Create: `src/test/worker.imageProcessing.test.ts`
- Modify: `package.json` (add `@cf-wasm/photon` dependency)

**Interfaces:**
- Produces: `buildR2KeyPrefix(locationId, timestamp)`, `buildVariantKey(prefix, variant)`, `PHOTO_VARIANTS`, `type PhotoVariant` from `photoKeys.ts`; `generateVariants(bytes, mimeType)` returning `{ thumb, medium, full, mimeType }` and `readJpegOrientation(bytes)` from `imageProcessing.ts`. Consumed by Task 04 (upload route) and Task 05 (serving route).

**Package note:** `@cf-wasm/photon` is a WASM port of the Rust `photon-rs` image library that runs inside the Cloudflare Workers runtime with no native bindings, needed because Cloudflare's URL-based Image Resizing isn't available on the current plan. Import from its `workerd` entrypoint — it self-initializes there (no manual `initPhoton()` call needed, unlike the browser/`others` entrypoint). Confirmed API surface (from the installed package's type definitions and README):
- `PhotonImage.new_from_byteslice(bytes: Uint8Array): PhotonImage`
- `resize(image: PhotonImage, width: number, height: number, filter: SamplingFilter): PhotonImage` — returns a **new** image
- `rotate(image: PhotonImage, angleDegrees: number): PhotonImage` — returns a **new** image
- `fliph(image: PhotonImage): void` / `flipv(image: PhotonImage): void` — mutate **in place**
- `image.get_width(): number` / `image.get_height(): number`
- `image.get_bytes_jpeg(quality: number): Uint8Array` — quality is `0`–`1`
- `image.free(): void` — must be called on every `PhotonImage` instance once done with it (Workers has a 128MB memory cap)

Photon does not read EXIF orientation itself, so a minimal JPEG EXIF parser is written by hand below — pure logic, no WASM dependency, fully unit-testable.

---

- [ ] **Step 1: Install the dependency**

```bash
npm install @cf-wasm/photon
```

---

- [ ] **Step 2: Write `photoKeys.ts`**

Create `src/worker/photoKeys.ts`:

```ts
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
```

---

- [ ] **Step 3: Write the failing tests for `readJpegOrientation`**

Create `src/test/worker.imageProcessing.test.ts`:

```ts
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
```

---

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/test/worker.imageProcessing.test.ts`
Expected: FAIL — `readJpegOrientation` is not exported from `../worker/imageProcessing` (module doesn't exist yet).

---

- [ ] **Step 5: Implement `readJpegOrientation`**

Create `src/worker/imageProcessing.ts` (this step only — the Photon-dependent parts are added in Step 7):

```ts
/**
 * Reads the EXIF Orientation tag (1-8) from a JPEG byte buffer by scanning
 * markers for the APP1/Exif segment. Returns 1 (no transform) if the file
 * isn't a JPEG, has no EXIF segment, or has no Orientation tag.
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return 1;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      break;
    }
    const marker = bytes[offset + 1];

    // Markers with no payload (SOI/RST/EOI) — skip the 2 marker bytes only.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // Start of Scan — no more metadata markers follow.
    if (marker === 0xda) {
      break;
    }

    const segmentLength = view.getUint16(offset + 2, false);

    if (marker === 0xe1) {
      const exifStart = offset + 4;
      const isExif =
        bytes[exifStart] === 0x45 && // E
        bytes[exifStart + 1] === 0x78 && // x
        bytes[exifStart + 2] === 0x69 && // i
        bytes[exifStart + 3] === 0x66; // f
      if (isExif) {
        const tiffStart = exifStart + 6;
        const little = view.getUint16(tiffStart, false) === 0x4949;
        const firstIfdOffset = view.getUint32(tiffStart + 4, little);
        const ifdStart = tiffStart + firstIfdOffset;
        const entryCount = view.getUint16(ifdStart, little);
        for (let i = 0; i < entryCount; i++) {
          const entryOffset = ifdStart + 2 + i * 12;
          const tag = view.getUint16(entryOffset, little);
          if (tag === 0x0112) {
            return view.getUint16(entryOffset + 8, little);
          }
        }
      }
    }

    offset += 2 + segmentLength;
  }

  return 1;
}
```

---

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/test/worker.imageProcessing.test.ts`
Expected: PASS (5/5).

---

- [ ] **Step 7: Write the failing test for `generateVariants` orchestration**

Add to `src/test/worker.imageProcessing.test.ts`, mocking `@cf-wasm/photon/workerd` entirely so the test verifies orchestration (which sizes/quality get requested, that images are freed) without needing the real WASM runtime, which only works inside `workerd`:

```ts
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
```

---

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run src/test/worker.imageProcessing.test.ts`
Expected: FAIL — `generateVariants` is not exported.

---

- [ ] **Step 9: Implement `generateVariants`**

Append to `src/worker/imageProcessing.ts`:

```ts
import { PhotonImage, SamplingFilter, resize, rotate, fliph, flipv } from "@cf-wasm/photon/workerd";

const THUMB_MAX_DIMENSION = 300;
const MEDIUM_MAX_DIMENSION = 1200;
const FULL_MAX_DIMENSION = 2048;
const THUMB_QUALITY = 0.75;
const MEDIUM_QUALITY = 0.8;
const FULL_QUALITY = 0.85;

/** Cloudflare Workers has a ~128MB memory cap; reject absurdly large uploads
 * before decoding rather than risk exceeding it mid-resize. */
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export interface PhotoVariantBytes {
  thumb: Uint8Array;
  medium: Uint8Array;
  full: Uint8Array;
  mimeType: string;
}

function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** EXIF orientation values (1-8) applied via Photon rotate/flip primitives.
 * `rotate` returns a new image and frees nothing itself, so the caller's
 * previous image reference must be freed after each reassignment. */
function applyExifOrientation(image: PhotonImage, orientation: number): PhotonImage {
  switch (orientation) {
    case 2:
      fliph(image);
      return image;
    case 3: {
      const rotated = rotate(image, 180);
      image.free();
      return rotated;
    }
    case 4:
      flipv(image);
      return image;
    case 5: {
      const rotated = rotate(image, 90);
      image.free();
      fliph(rotated);
      return rotated;
    }
    case 6: {
      const rotated = rotate(image, 90);
      image.free();
      return rotated;
    }
    case 7: {
      const rotated = rotate(image, 270);
      image.free();
      fliph(rotated);
      return rotated;
    }
    case 8: {
      const rotated = rotate(image, 270);
      image.free();
      return rotated;
    }
    default:
      return image;
  }
}

/**
 * Decodes `bytes`, corrects EXIF orientation, and produces three capped JPEG
 * variants (thumb/medium/full). Throws if the input is oversized or fails to
 * decode — callers should catch and fall back to storing the raw upload.
 */
export function generateVariants(bytes: Uint8Array, _mimeType: string): PhotoVariantBytes {
  if (bytes.length > MAX_INPUT_BYTES) {
    throw new Error(`Input image too large: ${bytes.length} bytes`);
  }

  const orientation = readJpegOrientation(bytes);
  let source = PhotonImage.new_from_byteslice(bytes);
  source = applyExifOrientation(source, orientation);

  const fullDims = scaledDimensions(source.get_width(), source.get_height(), FULL_MAX_DIMENSION);
  const fullImage = resize(source, fullDims.width, fullDims.height, SamplingFilter.Lanczos3);
  const fullBytes = fullImage.get_bytes_jpeg(FULL_QUALITY);

  const mediumDims = scaledDimensions(fullImage.get_width(), fullImage.get_height(), MEDIUM_MAX_DIMENSION);
  const mediumImage = resize(fullImage, mediumDims.width, mediumDims.height, SamplingFilter.Lanczos3);
  const mediumBytes = mediumImage.get_bytes_jpeg(MEDIUM_QUALITY);

  const thumbDims = scaledDimensions(mediumImage.get_width(), mediumImage.get_height(), THUMB_MAX_DIMENSION);
  const thumbImage = resize(mediumImage, thumbDims.width, thumbDims.height, SamplingFilter.Lanczos3);
  const thumbBytes = thumbImage.get_bytes_jpeg(THUMB_QUALITY);

  source.free();
  fullImage.free();
  mediumImage.free();
  thumbImage.free();

  return { thumb: thumbBytes, medium: mediumBytes, full: fullBytes, mimeType: "image/jpeg" };
}
```

---

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run src/test/worker.imageProcessing.test.ts`
Expected: PASS (8/8).

---

- [ ] **Step 11: Run full suite, lint, typecheck**

```bash
npm run test:run
npm run lint
npm run typecheck
```

Expected: all pass, 0 errors. If `typecheck` complains about `@cf-wasm/photon/workerd` module resolution, confirm `"moduleResolution"` in `tsconfig.json` supports package `exports` conditions (`"bundler"` or `"node16"`/`"nodenext"`) — do not change the resolution mode without checking what it's currently set to and why, since other imports depend on it.

---

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json src/worker/photoKeys.ts src/worker/imageProcessing.ts src/test/worker.imageProcessing.test.ts
git commit -m "feat: add EXIF-aware image variant generation via @cf-wasm/photon"
```
