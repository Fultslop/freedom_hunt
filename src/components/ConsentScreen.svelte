<script lang="ts">
  /* eslint-disable svelte/no-at-html-tags -- chip/bullet text is short, single-line
     author-controlled YAML content; parsed inline (no block p wrapper) so
     markdown emphasis renders instead of showing as literal asterisks. */
  import { marked } from "marked";
  import { AlertTriangle, Footprints, Wifi, Phone, Eye, ShieldAlert, Route, Clock, TrendingUp } from "lucide-svelte";
  import AppForm from "./AppForm.svelte";
  import MarkdownText from "./MarkdownText.svelte";
  import { postConsentUpdate } from "../utils/api";
  import { writeConsentCache } from "../utils/consentCache";
  import type { ConsentEntry } from "../types/data";
  import "./ConsentScreen.css";

  const ICONS = { AlertTriangle, Footprints, Wifi, Phone, Eye, ShieldAlert, Route, Clock, TrendingUp } as const;

  let {
    entry,
    project,
    city,
    route,
    ageThreshold = 16,
    onContinue = undefined,
  }: {
    entry: ConsentEntry;
    project: string;
    city: string;
    route: string;
    ageThreshold?: number;
    onContinue?: () => void;
  } = $props();

  // The age threshold varies per project (13-16 across the EU, spec §3), so
  // it can't be baked into the YAML label as a literal — content authors
  // write `{{age_threshold}}` in a field's label/subtext and it's resolved
  // here at render time from the project's `project.consent_age_threshold`.
  const resolvedFields = $derived(
    entry.fields.map((field) => ({
      ...field,
      label: field.label.replaceAll("{{age_threshold}}", String(ageThreshold)),
      subtext: field.subtext?.replaceAll("{{age_threshold}}", String(ageThreshold)),
    })),
  );

  async function handleSubmit(values: Record<string, unknown>) {
    const allSixteenPlus = values["all_sixteen_plus"] === "Yes";
    const promoConsent = values["promo_consent"] === true;
    try {
      const res = await postConsentUpdate(city, route, { allSixteenPlus, promoConsent, acknowledge: true });
      if (res.record) {
        writeConsentCache(project, city, route, { consentVersion: res.record.consent_version });
      }
    } catch {
      // Never blocks navigation — see spec §13.
    }
    onContinue?.();
  }
</script>

<div class="consent-screen">
  <h1 class="consent-screen__heading">{entry.heading}</h1>
  <div class="consent-screen__intro">
    <MarkdownText text={entry.intro} />
  </div>
  {#if entry.chips?.length}
    <ul class="consent-screen__chips">
      {#each entry.chips as chip (chip.text)}
        {@const ChipIcon = ICONS[chip.icon as keyof typeof ICONS]}
        <li class="consent-screen__chip">
          {#if ChipIcon}<ChipIcon size={18} class="consent-screen__chip-icon" aria-hidden="true" />{/if}
          <span class="consent-screen__chip-text">{@html marked.parseInline(chip.text)}</span>
        </li>
      {/each}
    </ul>
  {/if}
  {#each [entry.safety, entry.photos] as section, i (i)}
    <section class="consent-screen__section">
      <h2 class="consent-screen__section-heading">{section.heading}</h2>
      <ul class="consent-screen__bullets">
        {#each section.items as item, j (j)}
          {@const Icon = ICONS[item.icon as keyof typeof ICONS]}
          <li class="consent-screen__bullet">
            {#if Icon}<Icon size={18} class="consent-screen__bullet-icon" aria-hidden="true" />{/if}
            <span class="consent-screen__bullet-text">{@html marked.parseInline(item.text)}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  <div class="consent-screen__form">
    <AppForm
      fields={resolvedFields}
      onSubmit={handleSubmit}
      submitLabel={entry.primaryButtonText}
      alwaysSubmittable={true}
    />
  </div>
  {#if entry.privacyLinkUrl || entry.footerText}
    <div class="consent-screen__footer">
      {#if entry.privacyLinkUrl}
        <a class="consent-screen__privacy" href={entry.privacyLinkUrl} target="_blank" rel="noopener noreferrer">
          Read the full privacy notice
        </a>
      {/if}
      {#if entry.footerText}
        <MarkdownText text={entry.footerText} />
      {/if}
    </div>
  {/if}
</div>
