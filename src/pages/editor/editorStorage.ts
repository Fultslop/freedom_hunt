const PREFIX = "editor_pending_";

export interface PendingEntry {
  filename: string;
  [key: string]: unknown;
}

export function getPending(project: string, city: string): PendingEntry[] {
  try {
    const raw = localStorage.getItem(`${PREFIX}${project}_${city}`);
    return raw ? (JSON.parse(raw) as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

export function addPending(
  project: string,
  city: string,
  entry: PendingEntry,
): void {
  const current = getPending(project, city);
  const without = current.filter((e) => e.filename !== entry.filename);
  localStorage.setItem(
    `${PREFIX}${project}_${city}`,
    JSON.stringify([...without, entry]),
  );
}

export function removePending(
  project: string,
  city: string,
  filename: string,
): void {
  const current = getPending(project, city);
  localStorage.setItem(
    `${PREFIX}${project}_${city}`,
    JSON.stringify(current.filter((e) => e.filename !== filename)),
  );
}
