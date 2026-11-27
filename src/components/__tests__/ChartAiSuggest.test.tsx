import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ask = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => ask, createServerFn: () => ({}) }));
vi.mock("@/lib/chart-suggest.functions", () => ({ suggestChartAlternatives: ask }));
vi.mock("@/lib/ai-action", () => ({ metered: (fn: unknown) => fn }));

import { ChartAiSuggest } from "@/components/ChartAiSuggest";

const props = {
  schema: [
    { name: "a", type: "VARCHAR" },
    { name: "b", type: "DOUBLE" },
  ],
  config: { kind: "bar", x: "a", y: "b", agg: "SUM" } as never,
  points: [{ label: "x", value: 1 }],
  onApply: vi.fn(),
};

describe("ChartAiSuggest consent gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
    ask.mockClear();
  });
  it("disables the request button and never calls the server without consent", () => {
    render(<ChartAiSuggest {...props} />);
    const btn = screen.getByRole("button", { name: "اطلب اقتراحات" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(ask).not.toHaveBeenCalled();
  });
  it("shows the exact payload preview", () => {
    render(<ChartAiSuggest {...props} />);
    expect(document.body.textContent).toContain('"totalPoints": 1');
  });
});
