import {
  getPending,
  addPending,
  removePending,
  getDraft,
  saveDraft,
  clearDraft,
  updatePendingStatus,
  prWasClosed,
  clearCompletedPending,
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
      status: "pending",
    });
    const result = getPending("democrats_abroad/den_haag/locations");
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("001_loc_binnenhof.yaml");
  });

  it("addPending replaces existing entry with same filename", () => {
    addPending("ns", { filename: "001_loc_test.yaml", prUrl: "url-1", status: "pending" });
    addPending("ns", { filename: "001_loc_test.yaml", prUrl: "url-2", status: "pending" });
    expect(getPending("ns")).toHaveLength(1);
    expect(getPending("ns")[0].prUrl).toBe("url-2");
  });

  it("removePending removes the matching filename", () => {
    addPending("ns", { filename: "001_loc_test.yaml", status: "pending" });
    addPending("ns", { filename: "002_loc_other.yaml", status: "pending" });
    removePending("ns", "001_loc_test.yaml");
    const result = getPending("ns");
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("002_loc_other.yaml");
  });

  it("different namespaces are isolated", () => {
    addPending("project/city-a/locations", { filename: "001_loc_a.yaml", status: "pending" });
    addPending("project/city-b/locations", { filename: "001_loc_b.yaml", status: "pending" });
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

  // ---------------------------------------------------------------------------
  // updatePendingStatus
  // ---------------------------------------------------------------------------

  it("updatePendingStatus changes status of an existing entry", () => {
    addPending("ns", { filename: "001_loc_test.yaml", status: "submitting" });
    updatePendingStatus("ns", "001_loc_test.yaml", "pending");
    expect(getPending("ns")[0].status).toBe("pending");
  });

  it("updatePendingStatus does nothing when filename is not found", () => {
    addPending("ns", { filename: "001_loc_test.yaml", status: "submitting" });
    updatePendingStatus("ns", "999_loc_missing.yaml", "failed");
    expect(getPending("ns")[0].status).toBe("submitting");
  });

  // ---------------------------------------------------------------------------
  // prWasClosed
  // ---------------------------------------------------------------------------

  it("prWasClosed sets status to up_to_date and clears edit draft", () => {
    const draftKey = "editor_draft_ns_001_loc_test.yaml";
    addPending("ns", {
      filename: "001_loc_test.yaml",
      status: "pending",
      isNew: false,
    });
    saveDraft(draftKey, { title: "Stale" });

    prWasClosed("ns", "001_loc_test.yaml");

    expect(getPending("ns")[0].status).toBe("up_to_date");
    expect(getDraft(draftKey)).toBeNull();
  });

  it("prWasClosed clears the _new draft key when isNew is true", () => {
    const draftKey = "editor_draft_ns_new";
    addPending("ns", {
      filename: "001_loc_test.yaml",
      status: "pending",
      isNew: true,
    });
    saveDraft(draftKey, { title: "New draft" });

    prWasClosed("ns", "001_loc_test.yaml");

    expect(getPending("ns")[0].status).toBe("up_to_date");
    expect(getDraft(draftKey)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // clearCompletedPending
  // ---------------------------------------------------------------------------

  it("clearCompletedPending removes entries with status up_to_date", () => {
    addPending("ns", { filename: "001_loc_a.yaml", status: "up_to_date" });
    addPending("ns", { filename: "002_loc_b.yaml", status: "pending" });
    addPending("ns", { filename: "003_loc_c.yaml", status: "failed" });

    clearCompletedPending("ns");

    const result = getPending("ns");
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.filename)).not.toContain("001_loc_a.yaml");
  });

  it("clearCompletedPending is a no-op when no up_to_date entries exist", () => {
    addPending("ns", { filename: "001_loc_a.yaml", status: "pending" });
    clearCompletedPending("ns");
    expect(getPending("ns")).toHaveLength(1);
  });
});
