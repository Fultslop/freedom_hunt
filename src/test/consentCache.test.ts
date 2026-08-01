import { beforeEach } from "vitest";
import { readConsentCache, writeConsentCache } from "../utils/consentCache";

beforeEach(() => localStorage.clear());

test("writeConsentCache then readConsentCache round-trips the version", () => {
  writeConsentCache("democrats_abroad", "den_haag", "short_loop", { consentVersion: 3 });
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop")).toEqual({ consentVersion: 3 });
});

test("readConsentCache returns null when nothing was cached", () => {
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop")).toBeNull();
});

test("two different routes' cached versions do not collide", () => {
  writeConsentCache("democrats_abroad", "den_haag", "short_loop", { consentVersion: 3 });
  writeConsentCache("democrats_abroad", "oslo", "inner_circuit", { consentVersion: 7 });
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop")).toEqual({ consentVersion: 3 });
  expect(readConsentCache("democrats_abroad", "oslo", "inner_circuit")).toEqual({ consentVersion: 7 });
});
