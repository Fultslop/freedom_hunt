import { getExtension } from "../../utils/paths";

const LOCATION_INFIX = "_loc_";
const LOCATION_ID_LENGTH = 3;
const DEFAULT_EXTENSION = "yaml";

export interface LocationFilename {
  id: number;
  title: string;
  extension: string;
}

/**
 * Given a array of location filenames,determines the max id in that list based on the first
 * three characters and then returns the next id.
 * @param locationNames 
 * @returns max id + 1, or 0 if there are no valid ids in the list
 */
export function getNextLocationId(locationNames: string[]): number {
    const ids = locationNames
      .map((filename) => getLocationIndex(filename))
      .filter((locationId): locationId is number => !isNaN(locationId));
    return ids.length > 0 ? Math.max(...ids) + 1 : 0;
}

/**
 * Extracts the location index from the beginning of a filename if it follows the expected format, 
 * otherwise returns -1.
 * @param filename 
 * @returns 
 */
export function getLocationIndex(filename: string): number  {
  return filename 
      && filename.length >= LOCATION_ID_LENGTH
      && filename.slice(0, LOCATION_ID_LENGTH).split("").every((char) => char >= "0" && char <= "9")
    ? parseInt(filename.slice(0, LOCATION_ID_LENGTH), 10)
    : -1;
}

 /**
  * Create a LocationFilename object from a location index and title, using the default extension. The title will be sanitized when converting to a string, so it can contain special characters and spaces.
  * @param locationIndex 
  * @param title 
  * @returns 
  */
export function createLocationFilename(locationIndex: number, title: string) : LocationFilename {
  return {
    id: locationIndex,
    title: title,
    extension: DEFAULT_EXTENSION
  };
}

/**
 * Create a string filename from a LocationFilename object, 
 * using the format "{id}_loc_{sanitized_title}.{extension}". 
 * The id will be padded to 3 digits, and the title will be 
 * converted to lowercase, spaces will be replaced with underscores, 
 * and special characters will be removed.
 * @param location 
 * @returns 
 */
export function locationFilenameToString(location: LocationFilename): string {
  const slug = String(location.title)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return `${String(location.id).padStart(3, "0")}`.substring(0, LOCATION_ID_LENGTH)
    + LOCATION_INFIX
    + `${slug}.${location.extension}`;
}

/**
 * Attempts to parse a location filename and return a LocationFilename 
 * object if it is valid.
 * @param filename 
 * @returns 
 */
export function tryParseLocationName(filename: string | undefined | null) : LocationFilename | null {
  if (filename) {
    const minLength = LOCATION_ID_LENGTH 
      + LOCATION_INFIX.length 
      // Minimum length to accommodate location name and "an" extension 
      + 3; 

    if (filename.length >= minLength) {
      const locationIndex = getLocationIndex(filename);

      if (locationIndex >= 0) {
        const extension = getExtension(filename);
        const slug = filename.slice(LOCATION_ID_LENGTH + LOCATION_INFIX.length, -extension.length - 1);

        return { 
          id: locationIndex, 
          title: slug, 
          extension: extension 
        };
      }
    }
  }

  return null;
}
