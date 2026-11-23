import { describe, expect, it, vi } from "vitest";
import { runCloudAiRequest } from "@/lib/cloud-ai-consent";

describe("runCloudAiRequest", () => {
  it.each([
    ["missing consent", {}],
    ["explicit refusal", { cloudAiConsent: false }],
    ["persistence disabled is not consent", { cloudAiConsent: undefined, persist: false }],
    ["persistence enabled is not consent", { cloudAiConsent: undefined, persist: true }],
  ])("does not invoke the provider when %s", async (_name, request) => {
    const sendToProvider = vi.fn(async () => "provider response");

    const result = await runCloudAiRequest(request, sendToProvider);

    expect(result).toMatchObject({ ok: false, code: "cloud_consent_required" });
    expect(sendToProvider).not.toHaveBeenCalled();
  });

  it("invokes the provider only after explicit consent", async () => {
    const sendToProvider = vi.fn(async () => "provider response");

    const result = await runCloudAiRequest(
      { cloudAiConsent: true, persist: false },
      sendToProvider,
    );

    expect(result).toEqual({ ok: true, value: "provider response" });
    expect(sendToProvider).toHaveBeenCalledTimes(1);
  });
});
