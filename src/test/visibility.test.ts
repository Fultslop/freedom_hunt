import { evaluateVisibility, findReservedFunctionUsage, type VisibilityContext } from "../utils/visibility";
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";

beforeEach(() => {
  localStorage.clear();
});

function ctx(overrides: Partial<VisibilityContext> = {}): VisibilityContext {
  return { values: {}, fieldIds: new Set(), ...overrides };
}

describe("evaluateVisibility — static states", () => {
  it("is visible when isVisible is absent", () => {
    expect(evaluateVisibility(undefined, ctx())).toEqual({ status: "visible" });
  });

  it("is visible when initially is 'visible'", () => {
    expect(evaluateVisibility({ initially: "visible" }, ctx())).toEqual({ status: "visible" });
  });

  it("is hidden when initially is 'hidden'", () => {
    expect(evaluateVisibility({ initially: "hidden" }, ctx())).toEqual({ status: "hidden" });
  });

  it("errors when initially is 'conditional' with no condition/any/all/not", () => {
    const result = evaluateVisibility({ initially: "conditional" }, ctx());
    expect(result.status).toBe("error");
  });
});

describe("evaluateVisibility — bare-id source resolution (this form)", () => {
  const config = {
    initially: "conditional" as const,
    condition: { source: "all_sixteen_plus", operator: "=" as const, value: "Yes" },
  };

  it("is visible when the referenced field's live value matches", () => {
    const c = ctx({ values: { all_sixteen_plus: "Yes" }, fieldIds: new Set(["all_sixteen_plus"]) });
    expect(evaluateVisibility(config, c)).toEqual({ status: "visible" });
  });

  it("is hidden when the referenced field's live value doesn't match", () => {
    const c = ctx({ values: { all_sixteen_plus: "No" }, fieldIds: new Set(["all_sixteen_plus"]) });
    expect(evaluateVisibility(config, c)).toEqual({ status: "hidden" });
  });

  it("is hidden (not an error) when the referenced field simply hasn't been answered yet", () => {
    const c = ctx({ values: {}, fieldIds: new Set(["all_sixteen_plus"]) });
    expect(evaluateVisibility(config, c)).toEqual({ status: "hidden" });
  });

  it("errors when the bare id matches no field in this form", () => {
    const c = ctx({ values: {}, fieldIds: new Set(["some_other_field"]) });
    const result = evaluateVisibility(config, c);
    expect(result.status).toBe("error");
  });
});

describe("evaluateVisibility — dotted cross-form source resolution", () => {
  const config = {
    initially: "conditional" as const,
    condition: {
      source: "004_loc_lange_voorhout.form.manifesto",
      operator: "=" as const,
      value: "the people",
    },
  };
  const formContext = { project: "demo", city: "den_haag", route: "short_loop" };

  it("is visible when the other location's stored answer matches", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, {
      values: { manifesto: "the people" },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(evaluateVisibility(config, ctx({ formContext }))).toEqual({ status: "visible" });
  });

  it("is hidden (not an error) when the other location hasn't been visited yet", () => {
    expect(evaluateVisibility(config, ctx({ formContext }))).toEqual({ status: "hidden" });
  });

  it("errors when used without formContext", () => {
    const result = evaluateVisibility(config, ctx());
    expect(result.status).toBe("error");
  });
});

describe("evaluateVisibility — value resolution", () => {
  it("treats a bare word in 'value' as a literal, never a same-form field reference", () => {
    const config = {
      initially: "conditional" as const,
      condition: { source: "choice", operator: "=" as const, value: "other_field" },
    };
    const c = ctx({
      values: { choice: "other_field", other_field: "something else entirely" },
      fieldIds: new Set(["choice", "other_field"]),
    });
    // "value: other_field" is the literal string "other_field", not a lookup of
    // the other_field's own value — so this matches.
    expect(evaluateVisibility(config, c)).toEqual({ status: "visible" });
  });

  it("is hidden (not an error) when 'value' is a dotted cross-form reference to an unanswered location", () => {
    const config = {
      initially: "conditional" as const,
      condition: {
        source: "choice",
        operator: "=" as const,
        value: "004_loc_lange_voorhout.form.manifesto",
      },
    };
    const c = ctx({
      values: { choice: "something" },
      fieldIds: new Set(["choice"]),
      formContext: { project: "demo", city: "den_haag", route: "short_loop" },
    });
    // 004_loc_lange_voorhout has never been visited — its stored form is empty.
    expect(evaluateVisibility(config, c)).toEqual({ status: "hidden" });
  });
});

describe("evaluateVisibility — operators", () => {
  function leafCtx(sourceValue: unknown) {
    return ctx({ values: { x: sourceValue }, fieldIds: new Set(["x"]) });
  }
  function cond(operator: string, value?: unknown) {
    return { initially: "conditional" as const, condition: { source: "x", operator: operator as never, value: value as never } };
  }

  it("'=' and '!='", () => {
    expect(evaluateVisibility(cond("=", 5), leafCtx(5))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond("!=", 5), leafCtx(5))).toEqual({ status: "hidden" });
  });

  it("numeric ordering operators", () => {
    expect(evaluateVisibility(cond("<", 10), leafCtx(5))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond("<=", 5), leafCtx(5))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond(">", 10), leafCtx(5))).toEqual({ status: "hidden" });
    expect(evaluateVisibility(cond(">=", 6), leafCtx(5))).toEqual({ status: "hidden" });
  });

  it("'like' is case-insensitive substring containment, no wildcards", () => {
    expect(evaluateVisibility(cond("like", "voorhout"), leafCtx("Lange Voorhout"))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond("like", "VOORHOUT"), leafCtx("Lange Voorhout"))).toEqual({ status: "visible" });
    expect(evaluateVisibility(cond("like", "amsterdam"), leafCtx("Lange Voorhout"))).toEqual({ status: "hidden" });
  });

  it("'is null' / 'is not null' take no value and read the source's presence", () => {
    const present = { initially: "conditional" as const, condition: { source: "x", operator: "is null" as const } };
    const notNull = { initially: "conditional" as const, condition: { source: "x", operator: "is not null" as const } };
    expect(evaluateVisibility(present, leafCtx(undefined))).toEqual({ status: "visible" });
    expect(evaluateVisibility(notNull, leafCtx(undefined))).toEqual({ status: "hidden" });
    expect(evaluateVisibility(present, leafCtx("something"))).toEqual({ status: "hidden" });
    expect(evaluateVisibility(notNull, leafCtx("something"))).toEqual({ status: "visible" });
  });

  it("'is null' with an accompanying value is a runtime error (schema backstop)", () => {
    const bad = { initially: "conditional" as const, condition: { source: "x", operator: "is null" as const, value: "oops" } };
    expect(evaluateVisibility(bad, leafCtx(undefined)).status).toBe("error");
  });

  it("mismatched types error rather than silently coercing", () => {
    // radio/string field value "2" compared against the number 2
    const result = evaluateVisibility(cond(">", 2), leafCtx("2"));
    expect(result.status).toBe("error");
  });

  it("operator matching is exact/case-sensitive", () => {
    const result = evaluateVisibility(cond("IS NULL"), leafCtx(undefined));
    expect(result.status).toBe("error");
  });

  it("an unknown operator errors", () => {
    const result = evaluateVisibility(cond("~=", "x"), leafCtx("x"));
    expect(result.status).toBe("error");
  });
});

describe("evaluateVisibility — combinators", () => {
  function leafCtx(values: Record<string, unknown>) {
    return { values, fieldIds: new Set(Object.keys(values)) };
  }

  it("'any' is visible if at least one child is visible", () => {
    const config = {
      initially: "conditional" as const,
      any: [
        { source: "a", operator: "=" as const, value: "no-match" },
        { source: "b", operator: "=" as const, value: "yes" },
      ],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x", b: "yes" }))).toEqual({ status: "visible" });
  });

  it("'any' is hidden if every child is hidden", () => {
    const config = {
      initially: "conditional" as const,
      any: [
        { source: "a", operator: "=" as const, value: "no-match" },
        { source: "b", operator: "=" as const, value: "also-no" },
      ],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x", b: "y" }))).toEqual({ status: "hidden" });
  });

  it("'all' is visible only if every child is visible", () => {
    const config = {
      initially: "conditional" as const,
      all: [
        { source: "a", operator: "=" as const, value: "x" },
        { source: "b", operator: "=" as const, value: "y" },
      ],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x", b: "y" }))).toEqual({ status: "visible" });
    expect(evaluateVisibility(config, leafCtx({ a: "x", b: "not-y" }))).toEqual({ status: "hidden" });
  });

  it("'not' inverts its single child", () => {
    const config = {
      initially: "conditional" as const,
      not: { source: "a", operator: "=" as const, value: "x" },
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x" }))).toEqual({ status: "hidden" });
    expect(evaluateVisibility(config, leafCtx({ a: "not-x" }))).toEqual({ status: "visible" });
  });

  it("combinators nest arbitrarily", () => {
    // any( all(a=x, b=y), not(any(c=z)) )
    const config = {
      initially: "conditional" as const,
      any: [
        { all: [{ source: "a", operator: "=" as const, value: "x" }, { source: "b", operator: "=" as const, value: "y" }] },
        { not: { any: [{ source: "c", operator: "=" as const, value: "z" }] } },
      ],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "no", b: "no", c: "not-z" }))).toEqual({ status: "visible" });
    expect(evaluateVisibility(config, leafCtx({ a: "no", b: "no", c: "z" }))).toEqual({ status: "hidden" });
  });

  it("an error in any child propagates out of the combinator", () => {
    const config = {
      initially: "conditional" as const,
      any: [
        { source: "a", operator: "=" as const, value: "x" },
        { source: "does_not_exist", operator: "=" as const, value: "y" },
      ],
    };
    const result = evaluateVisibility(config, leafCtx({ a: "not-x" }));
    expect(result.status).toBe("error");
  });

  it("rejects a config with more than one of condition/any/all/not", () => {
    const config = {
      initially: "conditional" as const,
      condition: { source: "a", operator: "=" as const, value: "x" },
      any: [{ source: "a", operator: "=" as const, value: "x" }],
    };
    expect(evaluateVisibility(config, leafCtx({ a: "x" })).status).toBe("error");
  });
});

describe("evaluateVisibility — reserved 'function' operand", () => {
  const config = {
    initially: "conditional" as const,
    condition: { source: { function: "team_size_over", params: [4] }, operator: "=" as const, value: true },
  };

  it("throws when not production (default — matches dev/test)", () => {
    expect(() => evaluateVisibility(config, { values: {}, fieldIds: new Set() })).toThrow(/not implemented/);
  });

  it("throws when isProduction is explicitly false", () => {
    expect(() =>
      evaluateVisibility(config, { values: {}, fieldIds: new Set() }, { isProduction: false }),
    ).toThrow(/not implemented/);
  });

  it("falls back to hidden, never throws, when isProduction is true", () => {
    expect(
      evaluateVisibility(config, { values: {}, fieldIds: new Set() }, { isProduction: true }),
    ).toEqual({ status: "hidden" });
  });
});

describe("findReservedFunctionUsage", () => {
  it("flags a field whose isVisible uses a function operand", () => {
    const fields = [
      { id: "a", type: "boolean", label: "A" },
      {
        id: "b",
        type: "boolean",
        label: "B",
        isVisible: {
          initially: "conditional",
          condition: { source: { function: "team_size_over", params: [4] }, operator: "=", value: true },
        },
      },
    ];
    const messages = findReservedFunctionUsage(fields);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("'b'");
  });

  it("flags a function operand nested inside a combinator", () => {
    const fields = [
      {
        id: "c",
        type: "boolean",
        label: "C",
        isVisible: {
          initially: "conditional",
          any: [{ source: { function: "max", params: ["scores"] }, operator: ">", value: 10 }],
        },
      },
    ];
    expect(findReservedFunctionUsage(fields)).toHaveLength(1);
  });

  it("returns no messages for fields without isVisible, or with plain conditions", () => {
    const fields = [
      { id: "a", type: "boolean", label: "A" },
      {
        id: "b",
        type: "boolean",
        label: "B",
        isVisible: { initially: "conditional", condition: { source: "a", operator: "=", value: true } },
      },
    ];
    expect(findReservedFunctionUsage(fields)).toEqual([]);
  });
});
