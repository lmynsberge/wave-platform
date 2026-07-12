import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { nextStepHint, type AttributeSummary, type SignalPolicy } from "../src/api";
import { AttributeCard } from "../src/ProfileCards";

afterEach(cleanup);

const policy: SignalPolicy = {
  subjective: { emerging: { minEvidence: 5, minAuthors: 3 }, established: { minValidators: 5 } },
  objective: { emerging: { minDatapoints: 1 }, established: { minDatapoints: 3 } },
};
const base: AttributeSummary = {
  key: "leadership", name: "Leadership", kind: "subjective",
  evidenceCount: 5, distinctAuthors: 3,
  validations: { yes: 3, no: 1, noSignal: 0 }, distinctValidators: 3,
  status: "emerging", score: null,
};

function renderCard(a: AttributeSummary) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AttributeCard a={a} policy={policy} />
    </QueryClientProvider>,
  );
}

describe("AttributeCard invariants (SPEC-006 AC2/AC4)", () => {
  it("established shows the score", () => {
    renderCard({ ...base, status: "established", score: 75, distinctValidators: 5 });
    expect(screen.getByLabelText("score 75")).toBeDefined();
  });
  it("emerging shows NO score element (invariant 2)", () => {
    renderCard(base);
    expect(screen.queryByLabelText(/score/)).toBeNull();
  });
  it("insufficient renders neutral badge, not negative (invariant 5)", () => {
    renderCard({ ...base, status: "insufficient_signal", evidenceCount: 1, distinctAuthors: 1 });
    const badge = screen.getByText("building signal");
    expect(badge.className).toContain("insufficient");
    expect(document.querySelector('[class*="negative"], [class*="error"], [class*="danger"]')).toBeNull();
  });
});

describe("nextStepHint policy math (AC3)", () => {
  it("5/5 evidence, 3/3 authors, 3/5 validators → 2 more validators", () => {
    expect(nextStepHint(base, policy)).toBe("2 more validators to established");
  });
  it("below emerging names both gaps", () => {
    expect(nextStepHint({ ...base, evidenceCount: 3, distinctAuthors: 2, status: "insufficient_signal" }, policy))
      .toBe("2 more pieces of feedback and 1 more distinct voice to emerging");
  });
  it("objective counts datapoints", () => {
    expect(nextStepHint({ ...base, kind: "objective", evidenceCount: 1, status: "emerging" }, policy))
      .toBe("2 more datapoints to established");
  });
  it("established → no hint", () => {
    expect(nextStepHint({ ...base, status: "established", score: 80 }, policy)).toBeNull();
  });
});
