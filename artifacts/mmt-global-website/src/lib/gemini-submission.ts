type Submission = { requestId: string; instruction: string };

/** A synchronous lock also covers two submit events before React re-renders. */
export function createGeminiSubmissionController(
  newId: () => string = () => crypto.randomUUID(),
) {
  let active = false;
  let previous: Submission | null = null;
  return {
    begin(value: string): Submission | null {
      const instruction = value.trim();
      if (active || !instruction) return null;
      if (!previous || previous.instruction !== instruction) {
        previous = { requestId: newId(), instruction };
      }
      active = true;
      return { ...previous };
    },
    finish(keepForRetry: boolean) {
      active = false;
      if (!keepForRetry) previous = null;
    },
  };
}

export function canClearGeminiInput(
  submittedRevision: number,
  currentRevision: number,
  currentText: string,
  instruction: string,
): boolean {
  return submittedRevision === currentRevision && currentText.trim() === instruction;
}

export function mergeGeminiTurn<T extends { id: string; createdAt: string }>(
  turns: readonly T[],
  received: T,
): T[] {
  return [...turns.filter((turn) => turn.id !== received.id), received]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-40);
}
