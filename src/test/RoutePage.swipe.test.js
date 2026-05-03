import { clampedNext, clampedPrev } from "../pages/RoutePage";

test("clampedNext advances index", () => {
  expect(clampedNext(0, 3)).toBe(1);
  expect(clampedNext(1, 3)).toBe(2);
});

test("clampedNext does not exceed total - 1", () => {
  expect(clampedNext(2, 3)).toBe(2);
});

test("clampedPrev retreats index", () => {
  expect(clampedPrev(2)).toBe(1);
  expect(clampedPrev(1)).toBe(0);
});

test("clampedPrev does not go below 0", () => {
  expect(clampedPrev(0)).toBe(0);
});

test("clampedNext returns 0 when total is 0", () => {
  expect(clampedNext(0, 0)).toBe(0);
});
