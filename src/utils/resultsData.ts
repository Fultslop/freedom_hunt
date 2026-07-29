import type { FormField } from "../types/data";
import type { ResultsSubmission } from "../types/results";

export interface RouteLocationEntry {
  ordinal: number;
  locationId: string;
  name: string;
  fields: FormField[];
}

export type RouteIndex = Record<string, RouteLocationEntry[]>;

export interface GridRow {
  ordinal: number;
  locationName: string;
  teamName: string;
  submission: ResultsSubmission | undefined;
  submissionCount: number;
}

export interface LocationTeamAnswer {
  teamName: string;
  submission: ResultsSubmission;
  submissionCount: number;
}

export function teamsForRoute(submissions: ResultsSubmission[], routeId: string): string[] {
  const names = submissions
    .filter((sub) => sub.routeId === routeId)
    .map((sub) => sub.teamName);
  return [...new Set(names)].sort();
}

export function submissionsForCell(
  submissions: ResultsSubmission[],
  routeId: string,
  locationId: string,
  teamName: string,
): ResultsSubmission[] {
  return submissions.filter(
    (sub) =>
      sub.routeId === routeId &&
      sub.locationId === locationId &&
      sub.teamName === teamName,
  );
}

export function latestOf(subs: ResultsSubmission[]): ResultsSubmission | undefined {
  return subs.reduce<ResultsSubmission | undefined>((latest, sub) => {
    if (!latest || sub.submittedAt > latest.submittedAt) {
      return sub;
    }
    return latest;
  }, undefined);
}

export function earliestOf(subs: ResultsSubmission[]): ResultsSubmission | undefined {
  return subs.reduce<ResultsSubmission | undefined>((earliest, sub) => {
    if (!earliest || sub.submittedAt < earliest.submittedAt) {
      return sub;
    }
    return earliest;
  }, undefined);
}

export function buildRouteGrid(
  entries: RouteLocationEntry[],
  teams: string[],
  submissions: ResultsSubmission[],
  routeId: string,
): GridRow[] {
  const rows: GridRow[] = [];
  for (const entry of entries) {
    for (const teamName of teams) {
      const cellSubs = submissionsForCell(submissions, routeId, entry.locationId, teamName);
      rows.push({
        ordinal: entry.ordinal,
        locationName: entry.name,
        teamName,
        submission: latestOf(cellSubs),
        submissionCount: cellSubs.length,
      });
    }
  }
  return rows;
}

export function completionCount(
  entry: RouteLocationEntry,
  teams: string[],
  submissions: ResultsSubmission[],
  routeId: string,
): { answered: number; total: number } {
  const answered = teams.filter(
    (teamName) => submissionsForCell(submissions, routeId, entry.locationId, teamName).length > 0,
  ).length;
  return { answered, total: teams.length };
}

export function buildLocationReport(
  entry: RouteLocationEntry,
  teams: string[],
  submissions: ResultsSubmission[],
  routeId: string,
): LocationTeamAnswer[] {
  const report: LocationTeamAnswer[] = [];
  for (const teamName of teams) {
    const cellSubs = submissionsForCell(submissions, routeId, entry.locationId, teamName);
    const latest = latestOf(cellSubs);
    if (latest) {
      report.push({ teamName, submission: latest, submissionCount: cellSubs.length });
    }
  }
  return report.sort((rowA, rowB) => {
    const earliestA = submissionsForCell(submissions, routeId, entry.locationId, rowA.teamName);
    const earliestB = submissionsForCell(submissions, routeId, entry.locationId, rowB.teamName);
    const timeA = earliestOf(earliestA)?.submittedAt ?? 0;
    const timeB = earliestOf(earliestB)?.submittedAt ?? 0;
    return timeA - timeB;
  });
}

const SKIP_FIELD_TYPES = new Set(["section", "photo"]);

export function visibleFields(fields: FormField[]): FormField[] {
  return fields.filter((field) => !SKIP_FIELD_TYPES.has(field.type));
}

function isEmptyAnswer(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === undefined || value === null || value === "";
}

export function formatAnswerValue(field: FormField, value: unknown): string {
  if (isEmptyAnswer(value)) {
    return "No answer";
  }
  if (field.type === "boolean") {
    return value ? "Yes" : "No";
  }
  if (field.type === "radio" || field.type === "multiple") {
    return Array.isArray(value) ? value.join(", ") : String(value);
  }
  return String(value);
}
