import { describe, expect, it, vi } from "vitest";
import { consumeQuota } from "../quota.server";

describe("consumeQuota fail-closed behavior", () => {
  it.each(["PGRST202", "42883"])("rejects when the quota RPC is missing (%s)", async (code) => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code, message: "function does not exist" },
    });
    const client = { rpc } as unknown as Parameters<typeof consumeQuota>[0];

    await expect(consumeQuota(client)).rejects.toThrow("quota_check_failed");
    expect(rpc).toHaveBeenCalledWith("consume_ai_quota", {
      _action_id: null,
      _kind: "ai",
    });
  });

  it("rejects malformed quota responses", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as Parameters<typeof consumeQuota>[0];

    await expect(consumeQuota(client)).rejects.toThrow("quota_check_failed");
  });

  it("returns a valid quota decision", async () => {
    const quota = {
      allowed: true,
      reason: "ok",
      plan: "free",
      period: "month",
      limit: 30,
      used: 4,
      remaining: 26,
      is_anonymous: false,
    };
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: quota, error: null }),
    } as unknown as Parameters<typeof consumeQuota>[0];

    await expect(
      consumeQuota(client, "f7f9d60d-9e86-4c2e-8ed0-94fd56f4c9b1", "chat"),
    ).resolves.toEqual(quota);
  });
});
