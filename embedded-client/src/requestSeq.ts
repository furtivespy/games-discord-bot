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

/** Visible table must match the current picker value, not a slower earlier pick. */
export function shouldApplySnapshot(opts: {
  isCurrent: boolean;
  selectedChannelId: string;
  requestedChannelId: string;
  payloadChannelId?: string | null;
}): boolean {
  if (!opts.isCurrent) return false;
  const selected = String(opts.selectedChannelId || "").trim();
  const requested = String(opts.requestedChannelId || "").trim();
  if (!selected || selected !== requested) return false;
  const payload = String(opts.payloadChannelId || "").trim();
  if (payload && payload !== selected) return false;
  return true;
}
