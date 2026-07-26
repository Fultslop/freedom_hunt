import { shouldFireEffect, recordEffectFired, type EffectHistory } from "../utils/splashEffectHistory";

test("fires the first time an index is seen, with no repeat-effect config", () => {
  expect(shouldFireEffect({}, 3, undefined, 1000)).toBe(true);
});

test("does not fire again after the first time with no repeat-effect config", () => {
  const history: EffectHistory = { 3: { count: 1, lastFiredAt: 1000 } };
  expect(shouldFireEffect(history, 3, undefined, 999999)).toBe(false);
});

test("does not re-fire before the cooldown has elapsed", () => {
  const history: EffectHistory = { 3: { count: 1, lastFiredAt: 1000 } };
  expect(shouldFireEffect(history, 3, { cooldown: 30, max: 3 }, 1000 + 29_000)).toBe(false);
});

test("re-fires once the cooldown has elapsed", () => {
  const history: EffectHistory = { 3: { count: 1, lastFiredAt: 1000 } };
  expect(shouldFireEffect(history, 3, { cooldown: 30, max: 3 }, 1000 + 30_000)).toBe(true);
});

test("stops firing once max repeats is reached, even past cooldown", () => {
  const history: EffectHistory = { 3: { count: 3, lastFiredAt: 1000 } };
  expect(shouldFireEffect(history, 3, { cooldown: 10, max: 3 }, 999_999)).toBe(false);
});

test("recordEffectFired increments count and stamps the fire time for that index only", () => {
  const history: EffectHistory = { 3: { count: 1, lastFiredAt: 1000 } };
  const updated = recordEffectFired(history, 3, 5000);
  expect(updated).toEqual({ 3: { count: 2, lastFiredAt: 5000 } });
});

test("recordEffectFired initializes a fresh record for an unseen index", () => {
  const updated = recordEffectFired({}, 7, 2000);
  expect(updated).toEqual({ 7: { count: 1, lastFiredAt: 2000 } });
});
