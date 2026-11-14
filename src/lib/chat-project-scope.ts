/** Pure project-scope check shared by the chat client and server route. */
export function isSameProjectScope(
  threadProjectId: string | null | undefined,
  requestedProjectId: string | null | undefined,
): boolean {
  return (threadProjectId ?? null) === (requestedProjectId ?? null);
}