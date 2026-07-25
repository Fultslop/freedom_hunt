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

    // Start of Scan — no more metadata markers follow.
    if (marker === 0xda) {
      break;
    }

    const isNoPayload = marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
    if (isNoPayload) {
      offset += 2;
    } else {
      const segmentLength = view.getUint16(offset + 2, false);

      if (marker === 0xe1) {
        const exifStart = offset + 4;
        const isExif =
          bytes[exifStart] === 0x45 &&
          bytes[exifStart + 1] === 0x78 &&
          bytes[exifStart + 2] === 0x69 &&
          bytes[exifStart + 3] === 0x66;
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
  }

  return 1;
}

import { PhotonImage, SamplingFilter, resize, rotate, fliph, flipv } from "@cf-wasm/photon/workerd";

const THUMB_MAX_DIMENSION = 300;
const MEDIUM_MAX_DIMENSION = 1200;
const FULL_MAX_DIMENSION = 2048;
// get_bytes_jpeg's quality parameter is 0-100, not 0-1 — verified empirically
// against the real WASM module (photon_rs's underlying JPEG encoder uses the
// same 1-100 scale as most JPEG libraries). Any value <=1 silently floors to
// the minimum quality, which is why every uploaded photo looked heavily
// compressed until this was caught.
const THUMB_QUALITY = 75;
const MEDIUM_QUALITY = 80;
const FULL_QUALITY = 85;

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
