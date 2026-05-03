// AssetManager — fetches images at runtime from the deployment's /assets/img/ path.
// Images are cached in memory after first fetch so they are only downloaded once.
// No hardcoded filenames, no switch statements, no build-time bundling.
// Drop a file in src/data/img/ and reference it by name in YAML data — no code changes.

/** @type {Map<string, string>} */
const _cache = new Map();

/**
 * Fetch a image from the deployment and cache it. Subsequent calls for the same
 * imageName return the cached URL without re-fetching.
 * @param {string} imageName - e.g. "den-haag-logo.jpg"
 * @returns {Promise<string|null>} The object URL, or null on failure.
 */
export async function fetchImage(imageName) {
  if (!imageName) return null;

  // Return cached URL immediately if available
  if (_cache.has(imageName)) {
    return _cache.get(imageName);
  }

  try {
    const res = await fetch(`/assets/img/${imageName}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    _cache.set(imageName, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

/**
 * Synchronous lookup — returns null if the image hasn't been fetched yet.
 * Use this only for SSR/hydration scenarios; prefer fetchImage() everywhere else.
 * @param {string} imageName
 * @returns {string|null}
 */
export function getCachedImageUrl(imageName) {
  return _cache.get(imageName) ?? null;
}

/**
 * Pre-warms the cache for a list of image names. Resolves when all are cached.
 * Call this early (e.g. on app mount) to avoid flicker on first display.
 * @param {string[]} imageNames
 * @returns {Promise<void>}
 */
export async function preloadImages(imageNames) {
  await Promise.all(imageNames.map(fetchImage));
}
