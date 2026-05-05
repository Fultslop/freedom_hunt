<script lang="ts">
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

  function closeMenu() {
    menuView = null;
  }

  function handleBack() {
    if ($titleBarStore.backPath) {
      push($titleBarStore.backPath);
    }
  }
</script>

<div class="titlebar">
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
      <span class="titlebar__title">{$titleBarStore.title}</span>
    </div>

    <div class="titlebar__menu-wrap">
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
              <div class="titlebar__profile-field">
                <div class="titlebar__profile-label">Team</div>
                <div class="titlebar__profile-value">
                  {$authStore.activeAuth?.teamName ?? "—"}
                </div>
              </div>
              <div class="titlebar__profile-field titlebar__profile-field--last">
                <div class="titlebar__profile-label">Contact</div>
                <div class="titlebar__profile-value--contact">
                  {$authStore.activeAuth?.contact ?? "—"}
                </div>
              </div>
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
          100}%"
      ></div>
    </div>
  {/if}
</div>
