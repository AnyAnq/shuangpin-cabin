export function calculateAccuracy(correctKeystrokes: number, wrongKeystrokes: number): number {
  const total = correctKeystrokes + wrongKeystrokes;
  if (total === 0) return 100;
  return Math.round((correctKeystrokes / total) * 100);
}

export function calculateWpm(input: { completedChars: number; elapsedMs: number }): number {
  if (input.elapsedMs <= 0) return 0;
  return Math.round(input.completedChars / (input.elapsedMs / 60_000));
}
