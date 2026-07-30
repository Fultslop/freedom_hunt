/**
 * Canonical form for a hunt code / participant password: uppercase, no
 * surrounding whitespace, and `-`/`_`/space treated as equivalent (stripped).
 * Used on both the client (display) and the server (comparison) so a code
 * typed with different casing or separators than the organiser's stored
 * value still resolves and logs in.
 */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[-_\s]+/g, "");
}
