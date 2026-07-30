<script lang="ts">
  import { postVerifyCode } from "../utils/api";
  import { resolveHuntSummary, type HuntSummary as Summary } from "../utils/huntSummary";
  import { loadText } from "../utils/loadText";
  import { languageStore } from "../stores/languageStore";
  import HuntSummaryView from "./HuntSummary.svelte";
  import "./JoinSheet.css";

  interface Props {
    open: boolean;
    initialCode?: string;
    onResolved: (project: string) => void;
    onJoin: (project: string) => void;
    onDemo: () => void;
    onClose: () => void;
  }

  let props: Props = $props();

  // Seeded once from `initialCode` on mount, then freely editable — an
  // `$effect` (rather than `$state(props.initialCode ?? "")`) also re-seeds
  // it if `initialCode` itself later changes (e.g. a fresh deep link) without
  // clobbering the user's own typing on every unrelated re-render.
  let code = $state("");
  $effect(() => {
    code = props.initialCode ?? "";
  });
  let status = $state<"empty" | "checking" | "invalid">("empty");
  let error = $state<string | null>(null);
  let resolvedProject = $state<string | null>(null);
  let summary = $state<Summary | null>(null);
  let projectName = $state("");

  let canSubmit = $derived(code.trim().length >= 3);

  async function loadProjectData(project: string) {
    const lang = $languageStore.currentLang;
    const [projectMeta, huntSummary] = await Promise.all([
      loadText<Record<string, unknown>>(lang, `projects/${project}/${project}`),
      resolveHuntSummary(project, lang),
    ]);
    projectName = (projectMeta?.["project.name"] as string) ?? project;
    summary = huntSummary;
    props.onResolved(project);
  }

  async function verify(rawCode: string) {
    status = "checking";
    error = null;
    try {
      const trimmed = rawCode.trim();
      const data = await postVerifyCode(trimmed);
      if (data.ok && data.mode === "project" && data.project) {
        resolvedProject = data.project;
        await loadProjectData(data.project);
      } else if (data.ok && data.mode === "demo") {
        props.onDemo();
      } else {
        status = "invalid";
        error = "No hunt with that code. Check it with your organiser.";
      }
    } catch {
      status = "invalid";
      error = "Connection error. Please try again.";
    }
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    if (canSubmit) {
      verify(code);
    }
  }

    $effect(() => {
    const initCode = props.initialCode;
    if (initCode && initCode.trim().length >= 3) {
      verify(initCode);
    }
  });
</script>

<div
  class={`join-sheet${props.open ? " join-sheet--open" : ""}`}
  role="dialog"
  aria-modal="true"
  aria-hidden={!props.open}
  inert={!props.open}
>
  {#if resolvedProject}
    <p class="join-sheet__eyebrow join-sheet__eyebrow--success">Hunt found</p>
    <HuntSummaryView
      {summary}
      {projectName}
      cityLabel={summary ? "" : "multiple cities"}
      organiser={projectName}
    />
    <button type="button" class="join-sheet__primary" onclick={() => { if (resolvedProject) { props.onJoin(resolvedProject); } }}>Join this hunt</button>
    <p class="join-sheet__note">
      {summary
        ? "No account needed. You'll pick a team name next."
        : "No account needed. You'll pick a team name, then a city and route, next."}
    </p>
  {:else}
    <p class="join-sheet__eyebrow">Join a hunt</p>
    <h2 class="join-sheet__heading">Enter your hunt code</h2>
    <p class="join-sheet__help" id="join-sheet-help">
      Your organiser gave you a code, or it's on the QR you scanned.
    </p>
    <form onsubmit={handleSubmit} class="join-sheet__form">
      <label class="join-sheet__label" for="hunt-code">Hunt code</label>
      <input
        id="hunt-code"
        type="text"
        autocapitalize="off"
        autocomplete="off"
        enterkeyhint="go"
        bind:value={code}
        aria-describedby={error ? "join-sheet-error" : "join-sheet-help"}
        class="join-sheet__input"
      />
      {#if error}
        <p id="join-sheet-error" class="join-sheet__error" aria-live="polite">{error}</p>
      {/if}
      <button type="submit" class="join-sheet__primary" disabled={!canSubmit || status === "checking"}>
        {status === "checking" ? "Checking\u2026" : "Find hunt"}
      </button>
    </form>
    <div class="join-sheet__divider"></div>
    <button type="button" class="join-sheet__demo" onclick={() => props.onDemo()}>
      No code? Try the demo
    </button>
  {/if}
</div>
