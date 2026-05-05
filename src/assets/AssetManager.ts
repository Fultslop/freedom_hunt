const _cache = new Map<string, string>();

export async function fetchImage(imageName: string): Promise<string | null> {
  if (!imageName) return null;
  if (_cache.has(imageName)) return _cache.get(imageName)!;
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

export function getCachedImageUrl(imageName: string): string | null {
  return _cache.get(imageName) ?? null;
}

export async function preloadImages(imageNames: string[]): Promise<void> {
  await Promise.all(imageNames.map(fetchImage));
}
