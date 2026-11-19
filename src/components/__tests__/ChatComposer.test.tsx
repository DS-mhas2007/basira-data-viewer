import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatComposer } from "../ChatComposer";

describe("ChatComposer interactions", () => {
  function setup(value = "عن ماذا تعبر البيانات؟", busy = false) {
    const onSend = vi.fn();
    const onStop = vi.fn();
    const onChange = vi.fn();
    render(
      <ChatComposer
        value={value}
        busy={busy}
        onSend={onSend}
        onStop={onStop}
        onChange={onChange}
      />,
    );
    return { onSend, onStop, onChange, input: screen.getByRole("textbox") };
  }

  it("submits an Arabic question with Enter", () => {
    const { input, onSend } = setup();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("keeps Shift+Enter and composed text from submitting", () => {
    const { input, onSend } = setup();
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not submit an empty question", () => {
    const { input, onSend } = setup("   ");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "إرسال السؤال" }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("stops an active response without sending the draft", () => {
    const { input, onSend, onStop } = setup("سؤال لاحق", true);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "إيقاف الإجابة" }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("updates the draft", () => {
    const { input, onChange } = setup("");
    fireEvent.change(input, { target: { value: "لخص البيانات" } });
    expect(onChange).toHaveBeenCalledWith("لخص البيانات");
  });
});
