import {
  getPending,
  addPending,
  removePending,
  getDraft,
  saveDraft,
  clearDraft,
} from "../pages/editor/editorStorage";
import { describe, it, expect, beforeEach } from "vitest";

describe("editorStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // getPending / addPending / removePending (namespace API)
  // ---------------------------------------------------------------------------

  it("getPending returns empty array when nothing stored", () => {
    expect(getPending("democrats_abroad/den_haag/locations")).toEqual([]);
  });

  it("addPending stores an entry under the namespace key", () => {
    addPending("democrats_abroad/den_haag/locations", {
      filename: "001_loc_binnenhof.yaml",
      prUrl: "https://github.com/org/repo/pull/1",
    });
    const result = getPending("democrats_abroad/den_haag/locations");
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("001_loc_binnenhof.yaml");
  });

  it("addPending replaces existing entry with same filename", () => {
    addPending("ns", { filename: "001_loc_test.yaml", prUrl: "url-1" });
    addPending("ns", { filename: "001_loc_test.yaml", prUrl: "url-2" });
    expect(getPending("ns")).toHaveLength(1);
    expect(getPending("ns")[0].prUrl).toBe("url-2");
  });

  it("removePending removes the matching filename", () => {
    addPending("ns", { filename: "001_loc_test.yaml" });
    addPending("ns", { filename: "002_loc_other.yaml" });
    removePending("ns", "001_loc_test.yaml");
    const result = getPending("ns");
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("002_loc_other.yaml");
  });

  it("different namespaces are isolated", () => {
    addPending("project/city-a/locations", { filename: "001_loc_a.yaml" });
    addPending("project/city-b/locations", { filename: "001_loc_b.yaml" });
    expect(getPending("project/city-a/locations")[0].filename).toBe("001_loc_a.yaml");
    expect(getPending("project/city-b/locations")[0].filename).toBe("001_loc_b.yaml");
  });

  // ---------------------------------------------------------------------------
  // getDraft / saveDraft / clearDraft
  // ---------------------------------------------------------------------------

  it("getDraft returns null when nothing stored", () => {
    expect(getDraft("editor_draft_ns_001_loc_test.yaml")).toBeNull();
  });

  it("saveDraft and getDraft round-trip values", () => {
    saveDraft("editor_draft_ns_001_loc_test.yaml", { title: "Hello", count: 3 });
    expect(getDraft("editor_draft_ns_001_loc_test.yaml")).toEqual({
      title: "Hello",
      count: 3,
    });
  });

  it("clearDraft removes the stored draft", () => {
    saveDraft("draft_key", { title: "Hello" });
    clearDraft("draft_key");
    expect(getDraft("draft_key")).toBeNull();
  });
});
