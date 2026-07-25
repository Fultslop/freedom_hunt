export interface SheetRow {
  timestamp: string;
  routeId: string;
  locationId: string;
  teamName: string;
  email: string;
  fields: string;
}

export interface R2ObjectRef {
  key: string;
  locationId: string;
  timestamp: number;
}

export interface BackfillMatch {
  key: string;
  locationId: string;
  timestamp: number;
  teamName: string;
  routeId: string | null;
  contact: string | null;
  matched: boolean;
}

const MATCH_WINDOW_MS = 10 * 60 * 1000;

/** Parses the pre-Task-04 key format: `{locationId}_{timestamp}.{ext}`. */
export function parseR2Key(key: string): R2ObjectRef | null {
  const parsed = key.match(/^(.+)_(\d+)\.(jpg|png)$/);
  if (!parsed) {
    return null;
  }
  return { key, locationId: parsed[1], timestamp: Number(parsed[2]) };
}

export function matchPhotoToSheetRow(
  photo: R2ObjectRef,
  sheetRows: SheetRow[],
): BackfillMatch {
  const candidates = sheetRows
    .filter((row) => row.locationId === photo.locationId)
    .map((row) => ({ row, delta: Math.abs(Number(row.timestamp) - photo.timestamp) }))
    .filter((entry) => !Number.isNaN(entry.delta));

  const best = candidates.reduce<{ row: SheetRow; delta: number } | null>(
    (closest, entry) => (!closest || entry.delta < closest.delta ? entry : closest),
    null,
  );

  if (best && best.delta <= MATCH_WINDOW_MS) {
    return {
      key: photo.key,
      locationId: photo.locationId,
      timestamp: photo.timestamp,
      teamName: best.row.teamName || "Unknown",
      routeId: best.row.routeId || null,
      contact: best.row.email || null,
      matched: true,
    };
  }

  return {
    key: photo.key,
    locationId: photo.locationId,
    timestamp: photo.timestamp,
    teamName: "Unknown",
    routeId: null,
    contact: null,
    matched: false,
  };
}
