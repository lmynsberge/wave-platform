/** SPEC-021 R2: in-process counters. Exposure endpoint deferred to an observability spec. */
const counters = new Map<string, number>();

export const metrics = {
  increment(name: string): void {
    counters.set(name, (counters.get(name) ?? 0) + 1);
  },
  snapshot(): Record<string, number> {
    return Object.fromEntries(counters);
  },
};
