export type ConditionOperator =
  | "=" | "!=" | "<" | "<=" | ">" | ">="
  | "like" | "is null" | "is not null";

// A reference string (bare id / dotted cross-form ref), a literal, or a reserved
// function call whose params are themselves Operands — recursive so a future
// max/min/join-style transform can take a source reference (or another function
// call) as an argument without this type changing again. See design spec §4.3/§5.1.
export type Operand =
  | string
  | number
  | boolean
  | { function: string; params?: Operand[] };

export interface ConditionLeaf {
  source: Operand;
  operator: ConditionOperator;
  value?: Operand;
}

export interface ConditionAny {
  any: ConditionNode[];
}

export interface ConditionAll {
  all: ConditionNode[];
}

export interface ConditionNot {
  not: ConditionNode;
}

export type ConditionNode = ConditionLeaf | ConditionAny | ConditionAll | ConditionNot;

export interface VisibilityConfig {
  initially: "visible" | "hidden" | "conditional";
  condition?: ConditionNode;
  any?: ConditionNode[];
  all?: ConditionNode[];
  not?: ConditionNode;
}

export type VisibilityResult =
  | { status: "visible" }
  | { status: "hidden" }
  | { status: "error"; message: string };
