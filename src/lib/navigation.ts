// Notes items are private to whoever is running the service — they never
// appear on the Presenter screen, so navigation on both the Presenter and
// the Control page steps over them as if they weren't part of the running
// order at all.
export function isPresentable(item: { type: string }): boolean {
  return item.type !== "notes";
}

export function nextPresentableIndex(
  items: { type: string }[],
  from: number,
  direction: 1 | -1
): number {
  let i = from;
  while (i >= 0 && i < items.length && !isPresentable(items[i])) {
    i += direction;
  }
  if (i < 0 || i >= items.length) {
    // Ran off one end looking for a presentable item — clamp back to a
    // valid index instead of leaving the caller with an out-of-range one.
    return Math.max(0, Math.min(items.length - 1, from));
  }
  return i;
}
