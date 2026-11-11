import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("@workspace/db", () => ({ pool: { connect: async () => state } }));
vi.mock("./logisticsPoolAiDraft", () => ({
  LogisticsPoolAiDraftError: class extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));
import { withManualDraftLock } from "./logisticsManualDraftLock";

beforeEach(() => {
  state.query.mockReset(); state.release.mockReset();
  state.query.mockResolvedValue({ rows: [{ locked: true }] });
});
describe("one-shot draft connection lifecycle", () => {
  it("unlocks and returns the existing connection when generation fails", async () => {
    await expect(withManualDraftLock("TEST-only-match", async () => { throw new Error("TEST failure"); }))
      .rejects.toThrow("TEST failure");
    expect(state.query.mock.calls[1][0]).toContain("pg_advisory_unlock");
    expect(state.release).toHaveBeenCalledWith(false);
  });
  it("destroys the connection if unlock fails, so no lock leaks back into the pool", async () => {
    state.query.mockResolvedValueOnce({ rows: [{ locked: true }] }).mockRejectedValueOnce(new Error("TEST unlock failure"));
    expect(await withManualDraftLock("TEST-only-match", async () => "saved")).toBe("saved");
    expect(state.release).toHaveBeenCalledWith(true);
  });
});
