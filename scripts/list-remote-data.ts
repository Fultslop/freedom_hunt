#!/usr/bin/env node
import { d1Query } from "./wranglerRemote";

const NO_ROUTE_LABEL = "(no route)";

interface Counts {
  photos: number;
  forms: number;
}

interface CityEntry {
  total: Counts;
  routes: Map<string, Counts>;
}

interface ProjectEntry {
  total: Counts;
  cities: Map<string, CityEntry>;
}

interface CountRow {
  project_id: string;
  city_id: string;
  route_id: string | null;
  count: number;
}

function emptyCounts(): Counts {
  return { photos: 0, forms: 0 };
}

function getProject(tree: Map<string, ProjectEntry>, projectId: string): ProjectEntry {
  const existing = tree.get(projectId);
  if (existing) {
    return existing;
  } else {
    const created: ProjectEntry = { total: emptyCounts(), cities: new Map() };
    tree.set(projectId, created);
    return created;
  }
}

function getCity(project: ProjectEntry, cityId: string): CityEntry {
  const existing = project.cities.get(cityId);
  if (existing) {
    return existing;
  } else {
    const created: CityEntry = { total: emptyCounts(), routes: new Map() };
    project.cities.set(cityId, created);
    return created;
  }
}

function getRoute(city: CityEntry, routeKey: string): Counts {
  const existing = city.routes.get(routeKey);
  if (existing) {
    return existing;
  } else {
    const created = emptyCounts();
    city.routes.set(routeKey, created);
    return created;
  }
}

function queryScopeCounts(table: "photos" | "form_submissions"): CountRow[] {
  const rows = d1Query(
    `SELECT project_id, city_id, route_id, COUNT(*) as count FROM ${table} GROUP BY project_id, city_id, route_id`,
  );
  return rows as unknown as CountRow[];
}

function ingestRows(tree: Map<string, ProjectEntry>, rows: CountRow[], field: keyof Counts): void {
  for (const row of rows) {
    const project = getProject(tree, row.project_id);
    const city = getCity(project, row.city_id);
    const route = getRoute(city, row.route_id ?? NO_ROUTE_LABEL);

    project.total[field] += row.count;
    city.total[field] += row.count;
    route[field] += row.count;
  }
}

function formatCounts(counts: Counts): string {
  const photoLabel = counts.photos === 1 ? "photo" : "photos";
  const formLabel = counts.forms === 1 ? "form" : "forms";
  return `(${counts.photos} ${photoLabel}, ${counts.forms} ${formLabel})`;
}

function sortedEntryKeys<Value>(map: Map<string, Value>): string[] {
  return [...map.keys()].sort((left, right) => left.localeCompare(right));
}

function printRoutes(city: CityEntry): void {
  for (const routeId of sortedEntryKeys(city.routes)) {
    const counts = city.routes.get(routeId) as Counts;
    console.log(`    ${routeId} ${formatCounts(counts)}`);
  }
}

function printCities(project: ProjectEntry): void {
  for (const cityId of sortedEntryKeys(project.cities)) {
    const city = project.cities.get(cityId) as CityEntry;
    console.log(`  ${cityId} ${formatCounts(city.total)}`);
    printRoutes(city);
  }
}

function printTree(tree: Map<string, ProjectEntry>): void {
  if (tree.size === 0) {
    console.log("No data found in photos or form_submissions.");
  } else {
    for (const projectId of sortedEntryKeys(tree)) {
      const project = tree.get(projectId) as ProjectEntry;
      console.log(`${projectId} ${formatCounts(project.total)}`);
      printCities(project);
    }
  }
}

function main(): void {
  console.log("Querying remote data (photos + form_submissions)...\n");

  const tree = new Map<string, ProjectEntry>();
  ingestRows(tree, queryScopeCounts("photos"), "photos");
  ingestRows(tree, queryScopeCounts("form_submissions"), "forms");

  printTree(tree);
}

main();
