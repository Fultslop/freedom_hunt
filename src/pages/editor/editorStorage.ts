const PENDING_PREFIX = "editor_pending_";
const DRAFT_PREFIX = "editor_draft_";

export interface PendingEntry {
  filename: string;
  [key: string]: unknown;
}

export function getPending(namespace: string): PendingEntry[] {
  try {
    const raw = localStorage.getItem(`${PENDING_PREFIX}${namespace}`);
    return raw ? (JSON.parse(raw) as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

export function addPending(namespace: string, entry: PendingEntry): void {
  const current = getPending(namespace);
  const without = current.filter((e) => e.filename !== entry.filename);
  localStorage.setItem(
    `${PENDING_PREFIX}${namespace}`,
    JSON.stringify([...without, entry]),
  );
}

export function removePending(namespace: string, filename: string): void {
  const current = getPending(namespace);
  localStorage.setItem(
    `${PENDING_PREFIX}${namespace}`,
    JSON.stringify(current.filter((e) => e.filename !== filename)),
  );
}

export function getDraft(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, values: Record<string, unknown>): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    /* ignore storage quota errors */
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getPendingDraftKey(
  namespace: string,
  filename: string,
): string {
  return `${DRAFT_PREFIX}${namespace}_${filename}`;
}

export function findPendingByFilename(
  namespace: string,
  filename: string,
): PendingEntry | undefined {
  return getPending(namespace).find((e) => e.filename === filename);
}
