import { buildFormStorageKey, loadFormState } from "./formStorage";

export function computePhotosTaken(
  project: string,
  city: string,
  route: string | undefined,
  locationIds: string[],
  teamName: string,
): number {
  return locationIds.reduce((total, locId) => {
    const state = loadFormState(buildFormStorageKey(project, city, route, locId, teamName));
    const successCount = Object.values(state.uploads).filter(
      (upload) => upload.status === "success",
    ).length;
    return total + successCount;
  }, 0);
}

export function computeElapsedSinceFirstSubmission(
  project: string,
  city: string,
  route: string | undefined,
  locationIds: string[],
  now: number,
  teamName: string,
): number | undefined {
  const timestamps = locationIds
    .map((locId) => loadFormState(buildFormStorageKey(project, city, route, locId, teamName)).submittedAt)
    .filter((timestamp): timestamp is number => timestamp !== undefined);
  if (timestamps.length === 0) {
    return undefined;
  }
  return now - Math.min(...timestamps);
}

const MS_PER_MINUTE = 60_000;

export function formatElapsed(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.round(milliseconds / MS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}
