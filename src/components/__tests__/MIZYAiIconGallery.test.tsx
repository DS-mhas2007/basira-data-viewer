import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MIZYAiIconGallery } from "@/components/MIZYAiIconGallery";

describe("MIZYAiIconGallery", () => {
  it("renders the complete icon family and canonical palette", () => {
    render(<MIZYAiIconGallery />);

    expect(screen.getByText("34 أيقونة أصلية")).toBeInTheDocument();
    expect(screen.getAllByText("Void Navy").length).toBeGreaterThan(0);
    expect(screen.getAllByText("#60F5D2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("#D6B2FC").length).toBeGreaterThan(0);
    expect(screen.getByText("34 / 34 glyphs")).toBeInTheDocument();
  });

  it("switches icon tone and selected surface accessibly", () => {
    render(<MIZYAiIconGallery />);

    fireEvent.click(screen.getByRole("button", { name: "Lavender" }));
    expect(screen.getByRole("button", { name: "Lavender" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Void Navy" }));
    expect(screen.getByRole("button", { name: "Void Navy" })).toHaveAttribute("aria-pressed", "true");
  });

  it("filters the icon family by search and functional group", () => {
    render(<MIZYAiIconGallery />);

    fireEvent.change(screen.getByRole("textbox", { name: "ابحث عن أيقونة" }), {
      target: { value: "classification" },
    });
    expect(screen.getByText("التصنيف")).toBeInTheDocument();
    expect(screen.getByText("1 / 34 glyphs")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "ابحث عن أيقونة" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تعلم الآلة" }));
    expect(screen.getByText("10 / 34 glyphs")).toBeInTheDocument();
    expect(screen.getByText("منحنى ROC")).toBeInTheDocument();
  });
});
