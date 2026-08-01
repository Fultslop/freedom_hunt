import type {
  ConditionLeaf,
  ConditionNode,
  ConditionOperator,
  Operand,
  VisibilityConfig,
  VisibilityResult,
} from "../types/conditions";
import { parseSourceRef, getLocationFormValue } from "./locationFormLookup";

export interface VisibilityContext {
  /** This form's own live (in-progress) values, keyed by field id. */
  values: Record<string, unknown>;
  /** Every field id declared in this form, for bare-id existence checks. */
  fieldIds: Set<string>;
  /** Needed to resolve dotted cross-form references; omit where none are used. */
  formContext?: { project: string; city: string; route?: string; teamName: string };
}

export type { VisibilityResult };

const VISIBLE: VisibilityResult = { status: "visible" };
const HIDDEN: VisibilityResult = { status: "hidden" };

function errorResult(message: string): VisibilityResult {
  return { status: "error", message: `isVisible: ${message}` };
}

interface ResolvedOperand {
  value?: unknown;
  error?: string;
  reservedFunction?: true;
  /** A dotted cross-form reference that parsed fine but has no stored value yet
   * (the location hasn't been visited/answered) — not-met, never an error. Only
   * meaningful on the value side: on the source side `compare()` already treats
   * any undefined source as hidden regardless of cause. */
  unresolvedReference?: true;
}

function resolveStringOperand(
  str: string,
  ctx: VisibilityContext,
  isSourcePosition: boolean,
): ResolvedOperand {
  const ref = parseSourceRef(str);
  if (ref) {
    if (!ctx.formContext) {
      return { error: `cross-form reference '${str}' used without a formContext` };
    }
    const { project, city, route, teamName } = ctx.formContext;
    const value = getLocationFormValue(project, city, route, ref.locationId, ref.fieldId, teamName);
    return value === undefined ? { value: undefined, unresolvedReference: true } : { value };
  }
  if (isSourcePosition) {
    if (!ctx.fieldIds.has(str)) {
      return { error: `source '${str}' does not match any field in this form` };
    }
    return { value: ctx.values[str] };
  }
  return { value: str };
}

function resolveOperand(
  operand: Operand | undefined,
  ctx: VisibilityContext,
  isSourcePosition: boolean,
  isProduction: boolean,
): ResolvedOperand {
  if (operand === undefined) {
    return { value: undefined };
  }
  if (typeof operand === "number" || typeof operand === "boolean") {
    return { value: operand };
  }
  if (typeof operand === "object") {
    if (!isProduction) {
      throw new Error(`isVisible: 'function' operands are not implemented yet (attempted '${operand.function}')`);
    }
    return { reservedFunction: true };
  }
  return resolveStringOperand(operand, ctx, isSourcePosition);
}

function compareOrdered(
  source: string | number,
  operator: "<" | "<=" | ">" | ">=",
  value: string | number,
): VisibilityResult {
  switch (operator) {
    case "<":
      return source < value ? VISIBLE : HIDDEN;
    case "<=":
      return source <= value ? VISIBLE : HIDDEN;
    case ">":
      return source > value ? VISIBLE : HIDDEN;
    case ">=":
      return source >= value ? VISIBLE : HIDDEN;
  }
}

function compareLike(source: unknown, value: unknown): VisibilityResult {
  if (typeof source !== "string" || typeof value !== "string") {
    return errorResult(`'like' requires string operands, got ${typeof source} and ${typeof value}`);
  }
  return source.toLowerCase().includes(value.toLowerCase()) ? VISIBLE : HIDDEN;
}

function compareEquality(source: unknown, operator: "=" | "!=", value: unknown): VisibilityResult {
  if (operator === "=") {
    return source === value ? VISIBLE : HIDDEN;
  }
  return source !== value ? VISIBLE : HIDDEN;
}

function compareOrderedOperands(
  source: unknown,
  operator: ConditionOperator,
  value: unknown,
): VisibilityResult {
  if (typeof source === "boolean" || typeof value === "boolean") {
    return errorResult(`operator '${operator}' is not supported on boolean operands`);
  }
  return compareOrdered(source as string | number, operator as "<" | "<=" | ">" | ">=", value as string | number);
}

const ORDERED_OPERATORS: readonly ConditionOperator[] = ["<", "<=", ">", ">="];
const COMPARISON_OPERATORS: readonly ConditionOperator[] = ["=", "!=", "<", "<=", ">", ">=", "like"];

function compare(source: unknown, operator: ConditionOperator, value: unknown): VisibilityResult {
  if (!COMPARISON_OPERATORS.includes(operator)) {
    return errorResult(`unknown operator '${operator}'`);
  }
  if (source === undefined || source === null) {
    return HIDDEN;
  }
  if (operator === "like") {
    return compareLike(source, value);
  }
  if (typeof source !== typeof value) {
    return errorResult(
      `type mismatch comparing ${typeof source} (${JSON.stringify(source)}) to ${typeof value} (${JSON.stringify(value)}) with operator '${operator}'`,
    );
  }
  if (operator === "=" || operator === "!=") {
    return compareEquality(source, operator, value);
  }
  if (ORDERED_OPERATORS.includes(operator)) {
    return compareOrderedOperands(source, operator, value);
  }
  return errorResult(`unknown operator '${operator}'`);
}

function evaluateNullOperator(leaf: ConditionLeaf, sourceValue: unknown): VisibilityResult {
  if (leaf.value !== undefined) {
    return errorResult(`'${leaf.operator}' does not take a 'value'`);
  }
  const isNull = sourceValue === undefined || sourceValue === null;
  const met = leaf.operator === "is null" ? isNull : !isNull;
  return met ? VISIBLE : HIDDEN;
}

function evaluateLeaf(leaf: ConditionLeaf, ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  const sourceResult = resolveOperand(leaf.source, ctx, true, isProduction);
  if (sourceResult.reservedFunction) {
    return HIDDEN;
  }
  if (sourceResult.error) {
    return errorResult(sourceResult.error);
  }

  if (leaf.operator === "is null" || leaf.operator === "is not null") {
    return evaluateNullOperator(leaf, sourceResult.value);
  }

  const valueResult = resolveOperand(leaf.value, ctx, false, isProduction);
  if (valueResult.reservedFunction) {
    return HIDDEN;
  }
  if (valueResult.error) {
    return errorResult(valueResult.error);
  }
  if (valueResult.unresolvedReference) {
    return HIDDEN;
  }

  return compare(sourceResult.value, leaf.operator, valueResult.value);
}

function firstError(results: VisibilityResult[]): VisibilityResult | undefined {
  return results.find((r): r is Extract<VisibilityResult, { status: "error" }> => r.status === "error");
}

function evaluateAny(nodes: ConditionNode[], ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  const results = nodes.map((node) => evaluateNode(node, ctx, isProduction));
  return firstError(results) ?? (results.some((r) => r.status === "visible") ? VISIBLE : HIDDEN);
}

function evaluateAll(nodes: ConditionNode[], ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  const results = nodes.map((node) => evaluateNode(node, ctx, isProduction));
  return firstError(results) ?? (results.every((r) => r.status === "visible") ? VISIBLE : HIDDEN);
}

function evaluateNot(node: ConditionNode, ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  const result = evaluateNode(node, ctx, isProduction);
  if (result.status === "error") {
    return result;
  }
  return result.status === "visible" ? HIDDEN : VISIBLE;
}

function evaluateNode(node: ConditionNode, ctx: VisibilityContext, isProduction: boolean): VisibilityResult {
  if ("any" in node) {
    return evaluateAny(node.any, ctx, isProduction);
  }
  if ("all" in node) {
    return evaluateAll(node.all, ctx, isProduction);
  }
  if ("not" in node) {
    return evaluateNot(node.not, ctx, isProduction);
  }
  return evaluateLeaf(node, ctx, isProduction);
}

function topLevelNode(config: VisibilityConfig): { node?: ConditionNode; error?: string } {
  const present = (["condition", "any", "all", "not"] as const).filter((key) => config[key] !== undefined);
  if (present.length > 1) {
    return { error: `only one of condition/any/all/not may be present (got ${present.join(", ")})` };
  }
  if (config.condition) {
    return { node: config.condition };
  }
  if (config.any) {
    return { node: { any: config.any } };
  }
  if (config.all) {
    return { node: { all: config.all } };
  }
  if (config.not) {
    return { node: { not: config.not } };
  }
  return {};
}

export function evaluateVisibility(
  config: VisibilityConfig | undefined,
  ctx: VisibilityContext,
  options: { isProduction?: boolean } = {},
): VisibilityResult {
  if (!config || config.initially === "visible") {
    return VISIBLE;
  }
  if (config.initially === "hidden") {
    return HIDDEN;
  }
  const { node, error } = topLevelNode(config);
  if (error) {
    return errorResult(error);
  }
  if (!node) {
    return errorResult("'initially' is 'conditional' but no condition/any/all/not was provided");
  }
  const isProduction = options.isProduction ?? import.meta.env.PROD;
  return evaluateNode(node, ctx, isProduction);
}

function containsFunctionOperand(node: unknown): boolean {
  if (node === null || typeof node !== "object") {
    return false;
  }
  if ("function" in (node as Record<string, unknown>)) {
    return true;
  }
  if (Array.isArray(node)) {
    return node.some(containsFunctionOperand);
  }
  return Object.values(node as Record<string, unknown>).some(containsFunctionOperand);
}

/**
 * Authoring-time (CI) scanner — no relation to evaluateVisibility's runtime path.
 * Consumed only by scripts/validate-yaml.ts, which runs under plain tsx (no Vite),
 * so this must never call evaluateVisibility or otherwise touch import.meta.env.
 */
export function findReservedFunctionUsage(fields: unknown[]): string[] {
  const messages: string[] = [];
  for (const field of fields) {
    if (field && typeof field === "object" && "isVisible" in field) {
      const isVisible = (field as { isVisible?: unknown }).isVisible;
      if (containsFunctionOperand(isVisible)) {
        const typed = field as { id?: string; label?: string };
        const fieldId = typed.id ?? typed.label ?? "(unknown field)";
        messages.push(`'${fieldId}': isVisible uses a 'function' operand, which is not implemented yet`);
      }
    }
  }
  return messages;
}
