<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { fetchImage } from "../assets/AssetManager";
  import { loadText } from "../utils/loadText";
  import { postVerifyCode } from "../utils/api";
  import type { ApplicationText } from "../types/data";
  import "./CodeEntryPage.css";

  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: "/" });

  let appText = $state<ApplicationText | null>(null);
  let landingImageUrl = $state<string | null>(null);
  let imgHeight = $state(0);
  let code = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  $effect(() => {
    loadText<ApplicationText>($languageStore.currentLang, "application").then(
      (data) => {
        appText = data;
        if (data) {
          titleBarStore.set({
            title: data["app.title"] ?? "Freedom Hunt",
            progress: null,
            backPath: "/",
          });
        }
      },
    );
    fetchImage("landing-page.jpg").then((url) => {
      landingImageUrl = url;
    });
  });

  let contentMarginTop = $derived(
    imgHeight
      ? Math.round(-(imgHeight / 2 - window.innerHeight * 0.2))
      : landingImageUrl
        ? -80
        : 0,
  );

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    loading = true;
    try {
      const trimmed = code.trim();
      const data = await postVerifyCode(trimmed);
      if (data.ok && data.mode === "demo") {
        push("/login/demo");
      } else if (data.ok && data.mode === "project" && data.project) {
        sessionStorage.setItem(
          "pendingHuntAuth",
          JSON.stringify({ project: data.project, password: trimmed }),
        );
        push(`/join/${data.project}`);
      } else {
        error = "Invalid code. Please check and try again.";
      }
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="code-entry-page">
  {#if landingImageUrl}
    <div
      class="code-entry-page__hero-wrap"
      style={`height: ${imgHeight ? imgHeight / 2 + "px" : "auto"}`}
    >
      <img
        src={landingImageUrl}
        alt=""
        onload={(e) =>
          (imgHeight = (e.target as HTMLImageElement).offsetHeight)}
        class="code-entry-page__hero-img"
      />
      <div class="code-entry-page__hero-gradient"></div>
    </div>
  {/if}

  <div
    class="code-entry-page__content"
    style={`margin-top: ${contentMarginTop}px`}
  >
    {#if appText}
      <div class="code-entry-page__heading">
        <h1 class="code-entry-page__title">{appText["app.title"]}</h1>
        <p class="code-entry-page__tagline">{appText["app.tagline"]}</p>
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="code-entry-page__form">
      <div
        class={error
          ? "code-entry-page__field--error"
          : "code-entry-page__field"}
      >
        <label class="code-entry-page__label" for="code"
          >Scavenger hunt code</label
        >
        <input
          id="code"
          type="text"
          bind:value={code}
          required
          autocomplete="off"
          autocapitalize="off"
          placeholder="Enter your code"
          class={`code-entry-page__input${error ? " code-entry-page__input--error" : ""}`}
        />
      </div>

      {#if error}
        <div class="code-entry-page__error">✕ {error}</div>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class={`code-entry-page__submit${loading ? " code-entry-page__submit--loading" : ""}`}
      >
        {loading ? "Checking…" : "Continue"}
      </button>
    </form>
  </div>
</div>
