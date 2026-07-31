import type { Env } from "../types/worker";

export const KV_PREFIX_CONSENT_VERSION = "consent-version:";
const DEFAULT_CONSENT_VERSION = 1;

function consentVersionKey(project: string, city: string, route: string): string {
  return `${KV_PREFIX_CONSENT_VERSION}${project}:${city}:${route}`;
}

/** Reads the organiser-set current consent version, or the default (1) if never set. */
export async function getConsentVersion(
  env: Env,
  project: string,
  city: string,
  route: string,
): Promise<number> {
  const raw = await env.AUTH_STORE.get(consentVersionKey(project, city, route));
  if (raw === null) {
    return DEFAULT_CONSENT_VERSION;
  }
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? DEFAULT_CONSENT_VERSION : parsed;
}
