<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { themeStore } from "../stores/themeStore";
  import { fontSizeStore, FONT_SIZES } from "../stores/fontSizeStore";
  import { authStore } from "../stores/authStore";
  import { themes } from "../theme/themes";
  import type { ThemeName } from "../types/theme";
  import "./TitleBar.css";

  const FONT_WEIGHT_BOLD = 700;
  const FONT_WEIGHT_NORMAL = 400;

  let menuView = $state<string | null>(null);
  let menuWrapEl: HTMLDivElement | undefined;
  let titlebarEl: HTMLDivElement | undefined;

  // Publishes the bar's real rendered height (it varies with the progress
  // rule and back-button) so full-viewport screens like LandingPage can
  // size themselves to exactly `100dvh - this` instead of overflowing it.
  onMount(() => {
    if (!titlebarEl) {
      return undefined;
    }
    const publishHeight = () => {
      document.documentElement.style.setProperty("--titlebar-height", `${titlebarEl!.offsetHeight}px`);
    };
    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(titlebarEl);
    return () => observer.disconnect();
  });

  function closeMenu() {
    menuView = null;
  }

  function handleBack() {
    if ($titleBarStore.backPath) {
      push($titleBarStore.backPath);
    }
  }

  function handleWindowClick(event: MouseEvent) {
    // `composedPath()` is captured at dispatch time, before any handler runs.
    // Checking `.contains(event.target)` instead breaks for items whose own
    // onclick swaps `menuView` (root -> a submenu): that swap detaches the
    // clicked button synchronously, so by the time this bubbles up here,
    // `event.target` is no longer in the tree and `contains()` reads it as
    // "outside", closing the menu the same click that was meant to open a
    // submenu.
    if (menuView && menuWrapEl && !event.composedPath().includes(menuWrapEl)) {
      closeMenu();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (menuView && event.key === "Escape") {
      closeMenu();
    }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="titlebar" bind:this={titlebarEl}>
  <div class="titlebar__row">
    <div class="titlebar__left">
      {#if $titleBarStore.backPath}
        <button
          onclick={handleBack}
          aria-label="Back"
          class="titlebar__back-btn"
        >
          ←
        </button>
      {/if}
      <div class="titlebar__title-wrap">
        <span class="titlebar__title">{$titleBarStore.title}</span>
        {#if $titleBarStore.subtitle}
          <span
            class="titlebar__subtitle"
            data-testid="titlebar-subtitle"
          >{$titleBarStore.subtitle}{$titleBarStore.isDirty ? " *" : ""}</span>
        {/if}
      </div>
    </div>

    <div class="titlebar__menu-wrap" bind:this={menuWrapEl}>
      <button
        onclick={() => (menuView = menuView ? null : "root")}
        aria-label="Menu"
        class="titlebar__menu-btn"
      >
        ☰
      </button>

      {#if menuView}
        <div class="titlebar__dropdown">
          {#if menuView === "root"}
            <button
              onclick={() => (menuView = "profile")}
              class="titlebar__menu-item"
            >
              <span class="titlebar__menu-item-label">Profile</span>
              <span class="titlebar__menu-item-arrow">›</span>
            </button>
            <button
              onclick={() => (menuView = "themes")}
              class="titlebar__menu-item"
            >
              <span class="titlebar__menu-item-label">Themes</span>
              <span class="titlebar__menu-item-arrow">›</span>
            </button>
            <button
              onclick={() => (menuView = "fontsize")}
              class="titlebar__menu-item"
            >
              <span class="titlebar__menu-item-label">Text Size</span>
              <span class="titlebar__menu-item-arrow">›</span>
            </button>
          {/if}

          {#if menuView === "profile"}
            <button
              onclick={() => (menuView = "root")}
              aria-label="Back to menu"
              class="titlebar__submenu-header"
            >
              <span class="titlebar__submenu-back">‹</span>
              <span class="titlebar__submenu-title">Profile</span>
            </button>
            <div class="titlebar__profile-body">
              {#if $authStore.activeAuth?.kind === "participant"}
              <div class="titlebar__profile-field">
                <div class="titlebar__profile-label">Team</div>
                <div class="titlebar__profile-value">
                  {$authStore.activeAuth.teamName ?? "—"}
                </div>
              </div>
              <div class="titlebar__profile-field titlebar__profile-field--last">
                <div class="titlebar__profile-label">Contact</div>
                <div class="titlebar__profile-value--contact">
                  {$authStore.activeAuth.contact ?? "—"}
                </div>
              </div>
              {/if}
              <button
                onclick={async () => {
                  await authStore.logout();
                  closeMenu();
                }}
                class="titlebar__signout-btn"
              >
                Sign out
              </button>
            </div>
          {/if}

          {#if menuView === "themes"}
            <button
              onclick={() => (menuView = "root")}
              aria-label="Back to menu"
              class="titlebar__submenu-header"
            >
              <span class="titlebar__submenu-back">‹</span>
              <span class="titlebar__submenu-title">Themes</span>
            </button>
            {#each Object.keys(themes) as themeName (themeName)}
              <button
                onclick={() => {
                  themeStore.setThemeName(themeName as ThemeName);
                  closeMenu();
                }}
                class="titlebar__theme-btn"
                style="background: {themeName === $themeStore.themeName
                  ? $themeStore.theme.accent
                  : 'transparent'}; color: {themeName === $themeStore.themeName
                  ? $themeStore.theme.barText
                  : $themeStore.theme.text}; font-weight: {themeName ===
                $themeStore.themeName
                  ? FONT_WEIGHT_BOLD
                  : FONT_WEIGHT_NORMAL}"
              >
                <span>{themeName}</span>
                {#if themeName === $themeStore.themeName}
                  <span class="titlebar__theme-check">✓</span>
                {/if}
              </button>
            {/each}
          {/if}

          {#if menuView === "fontsize"}
            <button
              onclick={() => (menuView = "root")}
              aria-label="Back to menu"
              class="titlebar__submenu-header"
            >
              <span class="titlebar__submenu-back">‹</span>
              <span class="titlebar__submenu-title">Text Size</span>
            </button>
            {#each FONT_SIZES as fontSizeEntry (fontSizeEntry)}
              <button
                onclick={() => {
                  fontSizeStore.setFontSize(fontSizeEntry);
                  closeMenu();
                }}
                class="titlebar__theme-btn"
                style="background: {fontSizeEntry === $fontSizeStore.fontSize
                  ? $themeStore.theme.accent
                  : 'transparent'}; color: {fontSizeEntry ===
                $fontSizeStore.fontSize
                  ? $themeStore.theme.barText
                  : $themeStore.theme.text}; font-weight: {fontSizeEntry ===
                $fontSizeStore.fontSize
                  ? FONT_WEIGHT_BOLD
                  : FONT_WEIGHT_NORMAL}"
              >
                <span class="titlebar__fontsize-label">{fontSizeEntry}</span>
                {#if fontSizeEntry === $fontSizeStore.fontSize}
                  <span class="titlebar__theme-check">✓</span>
                {/if}
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if $titleBarStore.progress}
    <div
      data-testid="progress-bar"
      class="titlebar__progress-track"
    >
      <div
        class="titlebar__progress-fill"
        style="width: {($titleBarStore.progress.current /
          $titleBarStore.progress.total) *
          100}%;{$titleBarStore.progress.animateMs !== undefined
          ? ` transition-duration: ${$titleBarStore.progress.animateMs}ms;`
          : ''}"
      ></div>
    </div>
  {/if}
</div>
