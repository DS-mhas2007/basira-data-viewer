export interface AssistantTurnPart {
  type: string;
  text?: string;
  state?: string;
  output?: {
    ok?: boolean;
    message_ar?: string;
  };
}

export interface AssistantTurnMessage {
  role: string;
  parts: AssistantTurnPart[];
}

export type AssistantTurnOutcome =
  | { kind: "text" }
  | { kind: "tool-result"; message: string; ok: boolean }
  | { kind: "pending-tool" }
  | { kind: "empty" };

/**
 * Classifies the current user turn without treating the temporary "ready"
 * state between a tool call and its automatic continuation as a failed turn.
 */
export function inspectAssistantTurn(messages: AssistantTurnMessage[]): AssistantTurnOutcome {
  const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  const turnMessages = messages.slice(lastUserIndex + 1).filter((message) => message.role === "assistant");
  const parts = turnMessages.flatMap((message) => message.parts);

  const hasText = parts.some((part) => part.type === "text" && Boolean(part.text?.trim()));
  if (hasText) return { kind: "text" };

  const toolParts = parts.filter((part) => part.type.startsWith("tool-"));
  const hasPendingTool = toolParts.some((part) => part.state !== "output-available" && part.state !== "output-error");
  if (hasPendingTool) return { kind: "pending-tool" };

  const completed = toolParts.filter(
    (part) => part.state === "output-available" && Boolean(part.output?.message_ar?.trim()),
  );
  if (completed.length > 0) {
    return {
      kind: "tool-result",
      message: completed.map((part) => part.output!.message_ar!.trim()).join("\n\n"),
      ok: completed.every((part) => part.output?.ok !== false),
    };
  }

  return { kind: "empty" };
}

/** Returns user-facing text from completed tools when the model omitted its final prose. */
export function getToolResultFallback(parts: AssistantTurnPart[]): string | null {
  const messages = parts
    .filter(
      (part) =>
        part.type.startsWith("tool-") &&
        part.state === "output-available" &&
        Boolean(part.output?.message_ar?.trim()),
    )
    .map((part) => part.output!.message_ar!.trim());

  return messages.length > 0 ? messages.join("\n\n") : null;
}
