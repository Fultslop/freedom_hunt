<script lang="ts">
  import "./GalleryFilters.css";

  let {
    teams,
    tasks,
    selectedTeam,
    selectedTask,
    onTeamChange,
    onTaskChange,
  }: {
    teams: string[];
    tasks: string[];
    selectedTeam: string;
    selectedTask: string;
    onTeamChange: (value: string) => void;
    onTaskChange: (value: string) => void;
  } = $props();
</script>

<div class="gallery-filters">
  <label class="gallery-filters__field">
    <span class="gallery-filters__label">Team</span>
    <select
      id="gallery-team-filter"
      class="gallery-filters__select"
      value={selectedTeam}
      onchange={(e) => onTeamChange((e.target as HTMLSelectElement).value)}
    >
      <option value="">All teams</option>
      {#each teams as team (team)}
        <option value={team}>{team}</option>
      {/each}
    </select>
  </label>

  <label class="gallery-filters__field">
    <span class="gallery-filters__label">Task</span>
    <select
      class="gallery-filters__select"
      value={selectedTask}
      onchange={(e) => onTaskChange((e.target as HTMLSelectElement).value)}
    >
      <option value="">All tasks</option>
      {#each tasks as task (task)}
        <option value={task}>{task}</option>
      {/each}
    </select>
  </label>
</div>
