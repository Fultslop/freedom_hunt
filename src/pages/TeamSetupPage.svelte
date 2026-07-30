<script lang="ts">
  import { untrack } from "svelte";
  import { push } from "svelte-spa-router";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postLogin } from "../utils/api";
  import { generateTeamName, TEAM_NAME_ADJECTIVES, TEAM_NAME_NOUNS } from "../utils/teamNameGenerator";
  import { resolveHuntSummary, type HuntSummary } from "../utils/huntSummary";
  import { loadText } from "../utils/loadText";
  import { languageStore } from "../stores/languageStore";
  import SearchPlane from "../components/SearchPlane.svelte";
  import DepthWordmark from "../components/DepthWordmark.svelte";
  import AppForm from "../components/AppForm.svelte";
  import type { FormField } from "../types/data";
  import "./TeamSetupPage.css";

  let { params = {} }: { params?: Record<string, string> } = $props();

  let project = $derived(params.project ?? "");
  let teamNameKey = $derived(`teamName:${project}`);

  // Computed once, not reactively — this seeds the field's initial value
  // (a fresh $derived would re-roll a new random name on every unrelated
  // re-render, which is not what "prefilled, never empty" means). Matches
  // AppForm's own `untrack`-wrapped one-time value seeding.
  const initialTeamNameValue = untrack(
    () => (params.project && localStorage.getItem(`teamName:${params.project}`)) || generateTeamName(),
  );

  let summary = $state<HuntSummary | null>(null);
  let projectName = $state("");
  let routeStops = $derived(
    summary
      ? Array.from({ length: summary.stopCount }, (unused, index) => ({ id: `route-stop-${index}` }))
      : undefined,
  );

  async function loadProject() {
    const lang = $languageStore.currentLang;
    const [meta, sum] = await Promise.all([
      loadText<Record<string, unknown>>(lang, `projects/${project}/${project}`),
      resolveHuntSummary(project, lang),
    ]);
    projectName = (meta?.["project.name"] as string) ?? project;
    summary = sum;
  }

  $effect(() => {
    loadProject();
  });

  titleBarStore.set({ title: "Join the hunt", progress: { current: 2, total: 2 }, backPath: "/start" });

  // Every adjective x noun combo (1,024) so the reroll dice always offers a
  // genuinely different name, not the same single pre-picked value repeated.
  const teamNameOptions = TEAM_NAME_ADJECTIVES.flatMap((adjective) =>
    TEAM_NAME_NOUNS.map((noun) => `${adjective} ${noun}`),
  );

  let fields: FormField[] = $derived([
    {
      id: "teamName",
      type: "random_value",
      label: "Team name",
      values: teamNameOptions,
      value: initialTeamNameValue,
      reroll: true,
      editable: true,
    },
  ]);

  let error = $state<string | null>(null);

  function readPendingPassword(): string | null {
    const raw = sessionStorage.getItem("pendingHuntAuth");
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { project?: string; password?: string };
      if (parsed.project !== project || !parsed.password) {
        return null;
      }
      return parsed.password;
    } catch {
      return null;
    }
  }

  async function handleSubmit(values: Record<string, unknown>) {
    error = null;
    const password = readPendingPassword();
    if (!password) {
      push("/start");
    } else {
      const teamName = String(values.teamName ?? "");
      try {
        const data = await postLogin({ project, teamName, password });
        if (!data.ok) {
          throw new Error(data.error || "Something went wrong. Please try again.");
        }
        authStore.loginParticipant(project, data.teamName ?? teamName, data.contact ?? "", data.isAdmin ?? false);
        localStorage.setItem(teamNameKey, teamName);
        sessionStorage.removeItem("pendingHuntAuth");

        if (data.isAdmin) {
          push("/editor");
        } else {
          // Skip the city/route picker entirely when there's only one real
          // choice — for the one hunt actually live today, "Continue" drops
          // straight into the route instead of a picker with nothing to pick.
          const lang = $languageStore.currentLang;
          const freshSummary = summary ?? (await resolveHuntSummary(project, lang));
          push(freshSummary ? `/${project}/${freshSummary.cityId}/${freshSummary.routeId}` : `/${project}`);
        }
      } catch (err) {
        error = err instanceof Error ? err.message : "Connection error. Please try again.";
        throw err;
      }
    }
  }
</script>

<div class="team-setup-page">
  <div class="team-setup-page__bg">
    <SearchPlane mode={summary ? "route" : "frozen"} anchor={38} route={routeStops} />
  </div>

  <div class="team-setup-page__content">
    <DepthWordmark project={projectName || project} />
    <p class="team-setup-page__eyebrow">Step 2 of 2</p>
    <h2 class="team-setup-page__heading">Name your team</h2>
    <p class="team-setup-page__help">It shows on the leaderboard and on every photo you take.</p>
    {#if error}
      <p class="team-setup-page__error" aria-live="polite">{error}</p>
    {/if}
    <AppForm {fields} onSubmit={handleSubmit} submitLabel="Continue" />
  </div>
</div>
