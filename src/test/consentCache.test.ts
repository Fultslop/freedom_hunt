import { beforeEach } from "vitest";
import { readConsentCache, writeConsentCache } from "../utils/consentCache";

beforeEach(() => localStorage.clear());

test("writeConsentCache then readConsentCache round-trips the version", () => {
  writeConsentCache("democrats_abroad", "den_haag", "short_loop", { consentVersion: 3 }, "Team A", "a@b.com");
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop", "Team A", "a@b.com")).toEqual({
    consentVersion: 3,
  });
});

test("readConsentCache returns null when nothing was cached", () => {
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop", "Team A", "a@b.com")).toBeNull();
});

test("two different routes' cached versions do not collide", () => {
  writeConsentCache("democrats_abroad", "den_haag", "short_loop", { consentVersion: 3 }, "Team A", "a@b.com");
  writeConsentCache("democrats_abroad", "oslo", "inner_circuit", { consentVersion: 7 }, "Team A", "a@b.com");
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop", "Team A", "a@b.com")).toEqual({
    consentVersion: 3,
  });
  expect(readConsentCache("democrats_abroad", "oslo", "inner_circuit", "Team A", "a@b.com")).toEqual({
    consentVersion: 7,
  });
});

test("two members of the same team (same teamName, different contact) get independent consent caches", () => {
  writeConsentCache("demo", "new_york", "brooklyn_route", { consentVersion: 1 }, "Team A", "alice@test.com");
  expect(readConsentCache("demo", "new_york", "brooklyn_route", "Team A", "bob@test.com")).toBeNull();
  expect(readConsentCache("demo", "new_york", "brooklyn_route", "Team A", "alice@test.com")).toEqual({
    consentVersion: 1,
  });
});
