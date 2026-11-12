export function createRequestSeq() {
  let current = 0;
  return {
    next() {
      current += 1;
      return current;
    },
    isCurrent(id: number) {
      return id === current;
    },
    invalidate() {
      current += 1;
    },
  };
}

export function asCardList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (card) => card && typeof card === "object" && !Array.isArray(card)
  ) as Array<Record<string, unknown>>;
}
