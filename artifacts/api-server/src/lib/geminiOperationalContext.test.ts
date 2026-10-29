import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ row: {} as Record<string, unknown> }));
vi.mock("@workspace/db", () => ({
  db: { execute: vi.fn(async () => ({ rows: [state.row] })) },
}));
import { getGeminiOperationalContext } from "./geminiOperationalContext";
beforeEach(() => {
  state.row = {
    real_loads: "1", past_date_loads: "1", loads_without_contact_permission: "1",
    real_carriers: "0", approved_consented_carriers: "0",
    enabled_consented_sources: "0", eligible_real_pool_entries: "0",
  };
});
describe("anonymous operational context", () => {
  it("includes only allowlisted counts and labels preview explicitly", async () => {
    state.row.phone = "PRIVATE_PHONE";
    const result = await getGeminiOperationalContext();
    expect(JSON.parse(result).counts.real_loads).toBe(1);
    expect(result).toContain("development_preview");
    expect(result).not.toContain("PRIVATE_PHONE");
  });
  it.each([null, undefined, "invalid", "-1", "9007199254740992"])("rejects invalid counts: %s", async value => {
    state.row.real_loads = value;
    await expect(getGeminiOperationalContext()).rejects.toThrow();
  });
});
