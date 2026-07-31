import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { isParticipantToken } from "../../types/auth";
import { upsertConsent, getConsent } from "../db";
import { getConsentVersion } from "../consentVersion";
import { json } from "../utils";

export async function handleConsentRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method === "GET" && url.pathname === "/consent/version") {
    const project = url.searchParams.get("project") ?? "";
    const city = url.searchParams.get("city") ?? "";
    const route = url.searchParams.get("route") ?? "";
    const consentVersion = await getConsentVersion(env, project, city, route);
    return json({ ok: true, consentVersion });
  }

  if (request.method === "GET" && url.pathname === "/consent") {
    const authPayload = await requireAuth(request, env);
    if (!authPayload || !isParticipantToken(authPayload)) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const record = await getConsent(
      env.AUTH_DB,
      authPayload.project,
      authPayload.teamName,
      authPayload.contact || "",
    );
    return json({ ok: true, record });
  }

  if (request.method === "POST" && url.pathname === "/consent") {
    const authPayload = await requireAuth(request, env);
    if (!authPayload || !isParticipantToken(authPayload)) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    let body: { allSixteenPlus?: boolean; promoConsent?: boolean; acknowledge?: boolean };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    const contact = authPayload.contact || "";
    const existing = await getConsent(env.AUTH_DB, authPayload.project, authPayload.teamName, contact);

    // acknowledge:true (the consent screen itself) always re-stamps the
    // current version. acknowledge:false (the withdrawal menu, Task 11)
    // preserves whatever version the existing record already has — the
    // participant is only flipping a preference, not re-reading the text.
    // The `!existing` fallback only matters defensively; the menu can't
    // normally toggle a record that doesn't exist yet.
    const consentVersion =
      body.acknowledge || !existing
        ? await getConsentVersion(env, authPayload.project, url.searchParams.get("city") ?? "", url.searchParams.get("route") ?? "")
        : existing.consent_version;

    const record = await upsertConsent(
      env.AUTH_DB,
      { projectId: authPayload.project, teamName: authPayload.teamName, contact },
      { allSixteenPlus: !!body.allSixteenPlus, promoConsent: !!body.promoConsent, consentVersion },
    );
    return json({ ok: true, record });
  }

  return null;
}
