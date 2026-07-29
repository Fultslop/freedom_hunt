import { evaluateGate } from "../utils/routeRequirements";
import type { RouteEntry, FormsRequirement } from "../types/data";

function locationWithForm(title: string): RouteEntry {
  return {
    title,
    name: { value: title },
    coordinates: { latitude: 0, longitude: 0 },
    storyline: "s",
    breadcrumb: "b",
    challenge: { name: "", description: "d", form: [{ id: "note", type: "string", label: "Note" }] },
  };
}

const routeLocations = ["loc_a", "text_t", "loc_b", "chck_1"];
const entries: RouteEntry[] = [
  locationWithForm("Loc A"),
  { "template-type": "text", title: "T", text: "..." },
  locationWithForm("Loc B"),
  { "template-type": "checkpoint" }, // index 3 — the checkpoint being evaluated
];

test("forms requirement passes trivially when the requirements list is empty", () => {
  expect(evaluateGate(undefined, { entries, beforeIndex: 3, formStatusByIndex: {}, skippedIndices: new Set(), routeLocations })).toEqual({
    met: true,
  });
});

test("requires_all_forms_completed fails when any earlier form is incomplete, with missing titles listed", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: { loc_a: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set(),
    routeLocations,
  });
  expect(result.met).toBe(false);
  expect(result.message).toContain("Please finish up");
  expect(result.message).toContain("Loc B");
});

test("requires_all_forms_completed passes once every earlier form is submitted", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: {
      loc_a: { submitted: true, missingLabels: [] },
      loc_b: { submitted: true, missingLabels: [] },
    },
    skippedIndices: new Set(),
    routeLocations,
  });
  expect(result).toEqual({ met: true });
});

test("include_skipped (default true) counts a skipped form as completed", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: { loc_a: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set(["loc_b"]),
    routeLocations,
  });
  expect(result).toEqual({ met: true });
});

test("include_skipped: false does not count a skipped form as completed", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    include_skipped: false,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: { loc_a: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set(["loc_b"]),
    routeLocations,
  });
  expect(result.met).toBe(false);
});

test("min_completed_forms passes once the threshold count is met, without requiring all", () => {
  const req: FormsRequirement = {
    type: "forms",
    min_completed_forms: 1,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: { loc_a: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set(),
    routeLocations,
  });
  expect(result).toEqual({ met: true });
});

test("on_fail.include_missing_forms: false omits the missing-form titles from the message", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up", include_missing_forms: false },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: {},
    skippedIndices: new Set(),
  });
  expect(result.message).toBe("Please finish up");
});

import type { PeriodRequirement } from "../types/data";

test("period requirement fails before the start date", () => {
  const req: PeriodRequirement = {
    type: "period",
    start: { date: "2026-08-01" },
    on_fail: { message: "Not open yet" },
  };
  const result = evaluateGate([req], {
    entries: [],
    beforeIndex: 0,
    formStatusByIndex: {},
    skippedIndices: new Set(),
    now: new Date("2026-07-01"),
  });
  expect(result.met).toBe(false);
  expect(result.message).toBe("Not open yet (from 2026-08-01)");
});

test("period requirement passes within the start/end window", () => {
  const req: PeriodRequirement = {
    type: "period",
    start: { date: "2026-07-01" },
    end: { date: "2026-08-01" },
    on_fail: { message: "Not open yet" },
  };
  const result = evaluateGate([req], {
    entries: [],
    beforeIndex: 0,
    formStatusByIndex: {},
    skippedIndices: new Set(),
    now: new Date("2026-07-15"),
  });
  expect(result).toEqual({ met: true });
});

test("period requirement fails after the end date", () => {
  const req: PeriodRequirement = {
    type: "period",
    end: { date: "2026-07-01" },
    on_fail: { message: "Route closed", include_period: false },
  };
  const result = evaluateGate([req], {
    entries: [],
    beforeIndex: 0,
    formStatusByIndex: {},
    skippedIndices: new Set(),
    now: new Date("2026-07-15"),
  });
  expect(result).toEqual({ met: false, message: "Route closed" });
});

test("evaluateGate short-circuits on the first failing requirement and ignores the rest", () => {
  const failing: PeriodRequirement = {
    type: "period",
    start: { date: "2099-01-01" },
    on_fail: { message: "First failure", include_period: false },
  };
  const alsoFailing: PeriodRequirement = {
    type: "period",
    start: { date: "2099-01-01" },
    on_fail: { message: "Second failure" },
  };
  const result = evaluateGate([failing, alsoFailing], {
    entries: [],
    beforeIndex: 0,
    formStatusByIndex: {},
    skippedIndices: new Set(),
    now: new Date("2026-07-15"),
  });
  expect(result.message).toBe("First failure");
});

test("only counts locations strictly before beforeIndex, ignoring anything at or after it", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 1,
    formStatusByIndex: { loc_a: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set(),
    routeLocations,
  });
  expect(result).toEqual({ met: true });
});
