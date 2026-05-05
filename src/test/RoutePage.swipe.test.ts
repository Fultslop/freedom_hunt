import { clampedNext, clampedPrev } from "../utils/routeNav";

test("clampedNext advances index", () => {
  expect(clampedNext(0, 3)).toBe(1);
});

test("clampedNext clamps at last", () => {
  expect(clampedNext(2, 3)).toBe(2);
});

test("clampedPrev retreats index", () => {
  expect(clampedPrev(2)).toBe(1);
});

test("clampedPrev clamps at zero", () => {
  expect(clampedPrev(0)).toBe(0);
});
