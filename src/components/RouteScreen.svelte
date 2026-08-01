<script lang="ts">
  import ChallengeCard from "./ChallengeCard.svelte";
  import TextScreen from "./TextScreen.svelte";
  import SplashScreen from "./SplashScreen.svelte";
  import OptionsScreen from "./OptionsScreen.svelte";
  import ConsentScreen from "./ConsentScreen.svelte";
  import CompletionScreen from "./CompletionScreen.svelte";
  import type { RouteEntry, LocationEntry, CompletionStats, ConsentBulletSection } from "../types/data";

  let {
    entry,
    index,
    locationKey = undefined,
    isLast = false,
    isFirst = false,
    routeId = undefined,
    cityId = undefined,
    project = "",
    storeFormsInLocalStorage = true,
    allowResubmit = true,
    safetyDefault = undefined,
    photosDefault = undefined,
    badgeStatus = undefined,
    onFormStatusChange = undefined,
    onContinue = undefined,
    onPrev = undefined,
    isCurrent = true,
    stats = undefined,
  }: {
    entry: RouteEntry;
    index: number;
    locationKey?: string;
    isLast?: boolean;
    isFirst?: boolean;
    routeId?: string;
    cityId?: string;
    project?: string;
    storeFormsInLocalStorage?: boolean;
    allowResubmit?: boolean;
    safetyDefault?: ConsentBulletSection;
    photosDefault?: ConsentBulletSection;
    badgeStatus?: "submitted" | "skipped";
    onFormStatusChange?: (
      locationId: string,
      status: { submitted: boolean; missingLabels: string[] },
    ) => void;
    onContinue?: () => void;
    onPrev?: () => void;
    isCurrent?: boolean;
    stats?: CompletionStats;
  } = $props();

  let resolvedLocationKey = $derived(locationKey ?? String(index));
</script>

{#if entry["template-type"] === "checkpoint"}
  <!--
    Checkpoints are navigation gates evaluated by RoutePage — they must never
    become the "current" rendered entry. This branch is defense in depth: if
    that invariant is ever violated, render nothing rather than falling
    through to ChallengeCard and crashing on Location-shaped field access
    against a file that has none of those fields.
  -->
{:else if entry["template-type"] === "text"}
  <TextScreen image={entry.image} title={entry.title} text={entry.text} margin={entry.margin} />
{:else if entry["template-type"] === "splash"}
  <SplashScreen
    image={entry.image}
    title={entry.title}
    shader={entry.shader}
    effectConfig={entry.effect}
    anchor={entry.anchor}
    {isCurrent}
  />
{:else if entry["template-type"] === "completion"}
  <CompletionScreen
    image={entry.image}
    title={entry.title}
    subtitle={entry.subtitle}
    place={entry.place}
    caption={entry.caption}
    closingText={entry.closing_text}
    buttons={entry.buttons}
    hint={entry.hint}
    stats={stats ?? { stopsCompleted: 0, stopsTotal: 0, photosCount: "—", timeOnFoot: "—" }}
    project={project}
    cityId={cityId ?? ""}
    {isCurrent}
  />
{:else if entry["template-type"] === "options"}
  <OptionsScreen
    image={entry.image}
    title={entry.title}
    text={entry.text}
    options={entry.options}
    locationId={resolvedLocationKey}
    project={project}
    city={cityId ?? ""}
    route={routeId ?? ""}
    {onContinue}
  />
{:else if entry["template-type"] === "consent"}
  <ConsentScreen
    entry={entry}
    project={project}
    city={cityId ?? ""}
    route={routeId ?? ""}
    {safetyDefault}
    {photosDefault}
    {onContinue}
  />
{:else}
  <ChallengeCard
    location={entry as LocationEntry}
    {isLast}
    {isFirst}
    {index}
    locationKey={resolvedLocationKey}
    {routeId}
    {cityId}
    {project}
    {storeFormsInLocalStorage}
    {allowResubmit}
    {onFormStatusChange}
    {badgeStatus}
    {onContinue}
    {onPrev}
    {isCurrent}
  />
{/if}
