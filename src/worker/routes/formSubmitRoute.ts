import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { isParticipantToken } from "../../types/auth";
import { insertFormSubmission } from "../db";
import { json } from "../utils";

function generateId(): string {
  return crypto.randomUUID();
}

export async function handleFormSubmitRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "POST" || url.pathname !== "/form-submit") {
    return null;
  }

  const authPayload = await requireAuth(request, env);
  if (!authPayload || !isParticipantToken(authPayload)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: {
    locationId?: number;
    routeId?: string;
    cityId?: string;
    answers?: Record<string, unknown>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  try {
    await insertFormSubmission(env.AUTH_DB, {
      id: generateId(),
      project_id: authPayload.project,
      city_id: body.cityId ?? "unknown",
      route_id: body.routeId ?? null,
      location_id: String(body.locationId ?? "unknown"),
      team_name: authPayload.teamName,
      contact: authPayload.contact || null,
      answers: JSON.stringify(body.answers ?? {}),
      submitted_at: Math.floor(Date.now() / 1000),
    });
  } catch {
    return json({ ok: false, error: "Submission failed" }, 500);
  }

  if (authPayload.project === "democrats_abroad" && env.FORM_SCRIPT_URL) {
    try {
      await fetch(env.FORM_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      console.warn("Failed to forward form submission to Google Script");
    }
  }

  return json({ ok: true });
}
