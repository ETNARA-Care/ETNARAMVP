import { beforeEach, describe, expect, it, vi } from "vitest";
import { listFamilyIncidents, listFamilyObservations, listFamilyShifts } from "../api/familyCare";

describe("Family-safe care API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.setItem("etnara.session.token", "test-token");
  });

  it.each([
    ["observations", listFamilyObservations],
    ["incidents", listFamilyIncidents],
    ["shifts", listFamilyShifts],
  ])("uses the curated family-%s endpoint", async (resource, request) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ [resource]: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    await request("org-1", "recipient-1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/organizations/org-1/care-recipients/recipient-1/family-${resource}`),
      expect.any(Object)
    );
  });
});
