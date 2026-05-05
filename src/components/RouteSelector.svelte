<script lang="ts">
  import { push } from "svelte-spa-router";
  import type { RouteDefinition } from "../types/data";
  import "./RouteSelector.css";

  let {
    project,
    city,
    routeId,
    route,
  }: {
    project: string;
    city: string;
    routeId: string;
    route: RouteDefinition;
  } = $props();

  function handleNav() {
    push(`/${project}/${city}/${routeId}`);
  }
</script>

<div
  role="button"
  tabindex="0"
  class="route-card"
  onclick={handleNav}
  onkeydown={(evt) => (evt.key === "Enter" || evt.key === " ") && handleNav()}
>
  <div class="route-card__name">{routeId.replace(/_/g, " ")}</div>
  <div class="route-card__description">{route.description}</div>
  <div class="route-card__stops">
    {route.locations.length} stop{route.locations.length !== 1 ? "s" : ""}
  </div>
</div>