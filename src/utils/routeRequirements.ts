import type { RouteEntry, RouteRequirement, FormsRequirement, PeriodRequirement, LocationEntry } from "../types/data";
import { isLocationEntry, locationIdAt } from "./routeEntries";

export interface RequirementContext {
  entries: RouteEntry[];
  /** Only entries with array index strictly less than this are in scope. */
  beforeIndex: number;
  formStatusByIndex: Record<string, { submitted: boolean; missingLabels?: string[] }>;
  skippedIndices: Set<string>;
  /** Raw route location ids (from routeData.locations) indexed by entry position. */
  routeLocations?: string[];
  now?: Date;
}

export interface RequirementCheckResult {
  met: boolean;
  message?: string;
}

function priorLocationsWithForms(ctx: RequirementContext): Array<{ entry: LocationEntry; index: number }> {
  return ctx.entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      (item): item is { entry: LocationEntry; index: number } =>
        item.index < ctx.beforeIndex &&
        isLocationEntry(item.entry) &&
        (item.entry.challenge.form?.length ?? 0) > 0,
    );
}

function isFormComplete(
  ctx: RequirementContext,
  includeSkipped: boolean,
  index: number,
): boolean {
  const locKey = locationIdAt(ctx.routeLocations ?? [], index);
  const submitted = ctx.formStatusByIndex[locKey]?.submitted ?? false;
  const skipped = ctx.skippedIndices.has(locKey);
  return submitted || (includeSkipped && skipped);
}

function evaluateForms(req: FormsRequirement, ctx: RequirementContext): RequirementCheckResult {
  const candidates = priorLocationsWithForms(ctx);
  const includeSkipped = req.include_skipped ?? true;
  const complete = candidates.filter(({ index }) => isFormComplete(ctx, includeSkipped, index));

  const met = req.requires_all_forms_completed
    ? complete.length === candidates.length
    : complete.length >= (req.min_completed_forms ?? 0);

  if (met) {
    return { met: true };
  }

  const includeMissing = req.on_fail.include_missing_forms ?? true;
  if (!includeMissing) {
    return { met: false, message: req.on_fail.message };
  }
  const missingTitles = candidates
    .filter(({ index }) => !isFormComplete(ctx, includeSkipped, index))
    .map(({ entry }) => entry.title);
  const message =
    missingTitles.length > 0
      ? `${req.on_fail.message}\n\nMissing: ${missingTitles.join(", ")}`
      : req.on_fail.message;
  return { met: false, message };
}

function compareOp(a: number, operator: string, b: number): boolean {
  switch (operator) {
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case "=":
      return a === b;
    case ">":
      return a > b;
    case ">=":
    default:
      return a >= b;
  }
}

function periodMessage(req: PeriodRequirement): string {
  const includePeriod = req.on_fail.include_period ?? true;
  if (!includePeriod) {
    return req.on_fail.message;
  }
  const parts: string[] = [];
  if (req.start) {
    parts.push(`from ${req.start.date}`);
  }
  if (req.end) {
    parts.push(`until ${req.end.date}`);
  }
  return parts.length > 0 ? `${req.on_fail.message} (${parts.join(", ")})` : req.on_fail.message;
}

function evaluatePeriod(req: PeriodRequirement, now: Date): RequirementCheckResult {
  const nowMs = now.getTime();
  if (req.start && !compareOp(nowMs, req.start.operator ?? ">=", new Date(req.start.date).getTime())) {
    return { met: false, message: periodMessage(req) };
  }
  if (req.end && !compareOp(nowMs, req.end.operator ?? "<=", new Date(req.end.date).getTime())) {
    return { met: false, message: periodMessage(req) };
  }
  return { met: true };
}

export function evaluateGate(
  requirements: RouteRequirement[] | undefined,
  ctx: RequirementContext,
): RequirementCheckResult {
  for (const requirement of requirements ?? []) {
    const result =
      requirement.type === "forms" ? evaluateForms(requirement, ctx) : evaluatePeriod(requirement, ctx.now ?? new Date());
    if (!result.met) {
      return result;
    }
  }
  return { met: true };
}
