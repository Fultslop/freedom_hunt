export function clampedNext(current: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(current + 1, total - 1);
}

export function clampedPrev(current: number): number {
  return Math.max(current - 1, 0);
}
