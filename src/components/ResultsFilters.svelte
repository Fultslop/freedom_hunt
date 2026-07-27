<script lang="ts">
  import "./ResultsFilters.css";

  let {
    teams,
    locations,
    selectedTeam,
    selectedOrdinal,
    missingOnly,
    onTeamChange,
    onLocationChange,
    onMissingOnlyChange,
  }: {
    teams: string[];
    locations: { ordinal: number; name: string }[];
    selectedTeam: string;
    selectedOrdinal: string;
    missingOnly: boolean;
    onTeamChange: (value: string) => void;
    onLocationChange: (value: string) => void;
    onMissingOnlyChange: (value: boolean) => void;
  } = $props();
</script>

<div class="results-filters">
  <label class="results-filters__field">
    <span class="results-filters__label">Team</span>
    <select
      class="results-filters__select"
      value={selectedTeam}
      onchange={(evt) => onTeamChange((evt.target as HTMLSelectElement).value)}
    >
      <option value="">All teams</option>
      {#each teams as team (team)}
        <option value={team}>{team}</option>
      {/each}
    </select>
  </label>

  <label class="results-filters__field">
    <span class="results-filters__label">Location</span>
    <select
      class="results-filters__select"
      value={selectedOrdinal}
      onchange={(evt) => onLocationChange((evt.target as HTMLSelectElement).value)}
    >
      <option value="">All locations</option>
      {#each locations as location (location.ordinal)}
        <option value={String(location.ordinal)}>{location.name}</option>
      {/each}
    </select>
  </label>

  <label class="results-filters__checkbox-field">
    <input
      type="checkbox"
      checked={missingOnly}
      onchange={(evt) => onMissingOnlyChange((evt.target as HTMLInputElement).checked)}
    />
    Show only missing
  </label>
</div>
