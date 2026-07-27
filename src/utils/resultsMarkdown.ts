import type { ResultsSubmission } from "../types/results";
import {
  type RouteIndex,
  type RouteLocationEntry,
  teamsForRoute,
  buildLocationReport,
  visibleFields,
  formatAnswerValue,
} from "./resultsData";

function renderLocationSection(
  entry: RouteLocationEntry,
  teams: string[],
  submissions: ResultsSubmission[],
  routeId: string,
): string {
  const lines = [
    `#### Location ${entry.ordinal} — ${entry.name}`,
    "",
    "(ordered by date, fastest team first)",
    "",
  ];
  const report = buildLocationReport(entry, teams, submissions, routeId);
  for (const row of report) {
    lines.push(`*Team*: ${row.teamName}`);
    lines.push(`*Time*: ${new Date(row.submission.submittedAt * 1000).toISOString()}`);
    for (const field of visibleFields(entry.fields)) {
      const value = row.submission.answers[field.id ?? ""];
      if (value !== undefined) {
        lines.push(`Question: ${field.label}`);
        lines.push(`Answer: ${formatAnswerValue(field, value)}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderRouteSection(
  routeId: string,
  entries: RouteLocationEntry[],
  submissions: ResultsSubmission[],
): string {
  const teams = teamsForRoute(submissions, routeId);
  const lines = [`### Route: ${routeId.replace(/_/g, " ")}`, ""];
  for (const entry of entries) {
    lines.push(renderLocationSection(entry, teams, submissions, routeId));
  }
  return lines.join("\n");
}

export function buildResultsMarkdown(
  project: string,
  city: string,
  routeIndex: RouteIndex,
  submissions: ResultsSubmission[],
): string {
  const allTeams = [...new Set(submissions.map((sub) => sub.teamName))].sort();
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `${project.replace(/_/g, " ")} / ${city.replace(/_/g, " ")} Results`,
    "=====",
    today,
    "",
    "## Teams (alphabetical order)",
    ...allTeams.map((teamName) => `- ${teamName}`),
    "",
    "## Answers",
    "",
  ];
  for (const [routeId, entries] of Object.entries(routeIndex)) {
    lines.push(renderRouteSection(routeId, entries, submissions));
  }
  return lines.join("\n");
}
