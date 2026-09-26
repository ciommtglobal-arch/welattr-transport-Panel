import { afterEach, describe, expect, it, vi } from "vitest";
import { startOrphanUploadCleanupScheduler } from "./orphanUploadCleanupScheduler";

describe("orphan upload cleanup scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not schedule destructive cleanup in development by default", () => {
    vi.useFakeTimers();
    const runCleanup = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    startOrphanUploadCleanupScheduler({
      runCleanup,
      logger,
      env: { NODE_ENV: "development" },
    });

    expect(vi.getTimerCount()).toBe(0);
    expect(runCleanup).not.toHaveBeenCalled();
  });

  it("retries failures and schedules the next daily run after success", async () => {
    vi.useFakeTimers();
    const runCleanup = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValue(undefined);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const stop = startOrphanUploadCleanupScheduler({
      runCleanup,
      logger,
      env: { NODE_ENV: "production" },
    });

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(runCleanup).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(runCleanup).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(runCleanup).toHaveBeenCalledTimes(3);

    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("logs a final failure and retries on the next scheduled cycle", async () => {
    vi.useFakeTimers();
    const runCleanup = vi.fn<() => Promise<void>>().mockRejectedValue(
      new Error("storage unavailable"),
    );
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    startOrphanUploadCleanupScheduler({
      runCleanup,
      logger,
      env: { NODE_ENV: "production" },
    });

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await vi.advanceTimersByTimeAsync(60 * 1000);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(runCleanup).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("rejects invalid scheduler configuration", () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    expect(() =>
      startOrphanUploadCleanupScheduler({
        runCleanup: vi.fn().mockResolvedValue(undefined),
        logger,
        env: {
          NODE_ENV: "production",
          ORPHAN_UPLOAD_CLEANUP_INTERVAL_HOURS: "0",
        },
      }),
    ).toThrow("ORPHAN_UPLOAD_CLEANUP_INTERVAL_HOURS must be a positive integer.");
  });
});