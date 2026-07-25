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

  if (authPayload.project === "democrats_abroad") {
    try {
      const body = await request.text();
      const scriptRes = await fetch(env.FORM_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const scriptData = (await scriptRes.json()) as { ok?: boolean };
      return json({ ok: scriptData.ok ?? true });
    } catch {
      return json({ ok: false, error: "Submission failed" }, 500);
    }
  }

  try {
    const body = (await request.json()) as {
      locationId?: number;
      routeId?: string;
      cityId?: string;
      answers?: Record<string, unknown>;
    };
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
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Submission failed" }, 500);
  }
}
