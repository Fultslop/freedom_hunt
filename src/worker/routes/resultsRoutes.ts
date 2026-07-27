import type { Env } from "../../types/worker";
import type { DbFormSubmission } from "../db";
import type { ResultsSubmission } from "../../types/results";
import { requireParticipantForProject } from "../auth";
import { json } from "../utils";
import { listFormSubmissions } from "../db";

function toResultsSubmission(submission: DbFormSubmission): ResultsSubmission {
  return {
    id: submission.id,
    locationId: submission.location_id,
    routeId: submission.route_id,
    teamName: submission.team_name,
    answers: JSON.parse(submission.answers) as Record<string, unknown>,
    submittedAt: submission.submitted_at,
  };
}

export async function handleResultsRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "GET") {
    return null;
  }
  const match = url.pathname.match(/^\/results\/([^/]+)\/([^/]+)\/submissions$/);
  if (!match) {
    return null;
  }
  const [, project, city] = match;
  const authPayload = await requireParticipantForProject(request, env, project);
  if (!authPayload) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }
  const submissions = await listFormSubmissions(env.AUTH_DB, project, city);
  return json({ ok: true, submissions: submissions.map(toResultsSubmission) });
}
