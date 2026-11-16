import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MIZYAiIcon } from "@/components/MIZYAiIcon";

afterEach(cleanup);

describe("MIZYAiIcon accessibility", () => {
  it("exposes a supplied accessible title", () => {
    render(<MIZYAiIcon name="analytics" title="تحليل" />);
    expect(screen.getByRole("img", { name: "تحليل" })).toBeInTheDocument();
  });

  it("keeps decorative icons out of the accessibility tree", () => {
    render(<MIZYAiIcon name="dashboard" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("respects explicit aria-hidden even with a title", () => {
    render(<MIZYAiIcon name="assistant" title="مساعد" aria-hidden />);
    expect(screen.queryByRole("img", { name: "مساعد" })).not.toBeInTheDocument();
  });

  it("supports an accessible aria-label without a title", () => {
    render(<MIZYAiIcon name="quality" aria-label="جودة" />);
    expect(screen.getByRole("img", { name: "جودة" })).toBeInTheDocument();
  });

  it("keeps repeated icon titles independently associated", () => {
    render(
      <>
        <MIZYAiIcon name="upload" title="رفع" />
        <MIZYAiIcon name="download" title="تنزيل" />
      </>,
    );
    expect(screen.getByRole("img", { name: "رفع" })).not.toBe(
      screen.getByRole("img", { name: "تنزيل" }),
    );
  });
});
