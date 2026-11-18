export interface AssistantTurnPart {
  type: string;
  text?: string;
  state?: string;
  output?: unknown;
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

function readToolMessage(part: AssistantTurnPart): { message: string; ok: boolean } | null {
  if (typeof part.output !== "object" || part.output === null || !("message_ar" in part.output)) return null;
  const message = part.output.message_ar;
  if (typeof message !== "string" || !message.trim()) return null;
  const ok = !("ok" in part.output) || part.output.ok !== false;
  return { message: message.trim(), ok };
}

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

  const completed = toolParts
    .filter((part) => part.state === "output-available")
    .map(readToolMessage)
    .filter((result): result is { message: string; ok: boolean } => result !== null);
  if (completed.length > 0) {
    return {
      kind: "tool-result",
      message: completed.map((result) => result.message).join("\n\n"),
      ok: completed.every((result) => result.ok),
    };
  }

  return { kind: "empty" };
}

/** Returns user-facing text from completed tools when the model omitted its final prose. */
export function getToolResultFallback(parts: AssistantTurnPart[]): string | null {
  const messages = parts
    .filter((part) => part.type.startsWith("tool-") && part.state === "output-available")
    .map(readToolMessage)
    .filter((result): result is { message: string; ok: boolean } => result !== null)
    .map((result) => result.message);

  return messages.length > 0 ? messages.join("\n\n") : null;
}
