<script lang="ts">
  import ChallengeCard from "./ChallengeCard.svelte";
  import TextScreen from "./TextScreen.svelte";
  import SplashScreen from "./SplashScreen.svelte";
  import OptionsScreen from "./OptionsScreen.svelte";
  import type { RouteEntry, LocationEntry } from "../types/data";

  let {
    entry,
    index,
    isLast = false,
    routeId = undefined,
    cityId = undefined,
    project = "",
    storeFormsInLocalStorage = true,
    allowResubmit = true,
    badgeStatus = undefined,
    onFormStatusChange = undefined,
    onContinue = undefined,
    isCurrent = true,
  }: {
    entry: RouteEntry;
    index: number;
    isLast?: boolean;
    routeId?: string;
    cityId?: string;
    project?: string;
    storeFormsInLocalStorage?: boolean;
    allowResubmit?: boolean;
    badgeStatus?: "submitted" | "skipped";
    onFormStatusChange?: (
      locationId: number,
      status: { submitted: boolean; missingLabels: string[] },
    ) => void;
    onContinue?: () => void;
    isCurrent?: boolean;
  } = $props();
</script>

{#if entry["template-type"] === "text"}
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
{:else if entry["template-type"] === "options"}
  <OptionsScreen
    image={entry.image}
    title={entry.title}
    text={entry.text}
    options={entry.options}
    {index}
    project={project}
    city={cityId ?? ""}
    route={routeId ?? ""}
    {onContinue}
  />
{:else}
  <ChallengeCard
    location={entry as LocationEntry}
    {isLast}
    {index}
    {routeId}
    {cityId}
    {project}
    {storeFormsInLocalStorage}
    {allowResubmit}
    {onFormStatusChange}
    {badgeStatus}
  />
{/if}
