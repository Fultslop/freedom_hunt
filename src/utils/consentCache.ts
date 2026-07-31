export interface ConsentCache {
  consentVersion: number;
}

function cacheKey(project: string, city: string, route: string): string {
  return `${project}/${city}/${route}/consent`;
}

export function writeConsentCache(project: string, city: string, route: string, cache: ConsentCache): void {
  localStorage.setItem(cacheKey(project, city, route), JSON.stringify(cache));
}

export function readConsentCache(project: string, city: string, route: string): ConsentCache | null {
  const raw = localStorage.getItem(cacheKey(project, city, route));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ConsentCache;
  } catch {
    return null;
  }
}
