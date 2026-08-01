export interface ConsentCache {
  consentVersion: number;
}

function cacheKey(project: string, city: string, route: string, teamName: string, contact: string): string {
  return `${project}/${teamName}/${contact}/${city}/${route}/consent`;
}

export function writeConsentCache(
  project: string,
  city: string,
  route: string,
  cache: ConsentCache,
  teamName: string,
  contact: string,
): void {
  localStorage.setItem(cacheKey(project, city, route, teamName, contact), JSON.stringify(cache));
}

export function readConsentCache(
  project: string,
  city: string,
  route: string,
  teamName: string,
  contact: string,
): ConsentCache | null {
  const raw = localStorage.getItem(cacheKey(project, city, route, teamName, contact));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ConsentCache;
  } catch {
    return null;
  }
}
