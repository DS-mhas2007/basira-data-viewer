import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "./ChatMarkdown";

describe("ChatMarkdown", () => {
  it("renders GFM tables as real tables and blocks images", () => {
    const { container } = render(
      <ChatMarkdown>{"| الدولة | العدد |\n|---|---|\n| USA | 352 |\n\n![x](https://evil.test/a.png)"}</ChatMarkdown>,
    );
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll("td")).toHaveLength(2);
    expect(container.querySelector("img")).toBeNull();
  });
});
