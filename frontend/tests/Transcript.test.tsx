import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Transcript } from "../src/components/Transcript.tsx";
import { runResult } from "./fixtures.ts";

describe("Transcript", () => {
  it("reveals turns one at a time rather than all at once", async () => {
    render(<Transcript turns={runResult.transcript} revealMs={10} />);
    expect(screen.getAllByTestId("bubble")).toHaveLength(1);
    await waitFor(() => expect(screen.getAllByTestId("bubble")).toHaveLength(6));
  });

  it("keeps the strict order: search, four votes, final", async () => {
    render(<Transcript turns={runResult.transcript} revealMs={1} />);
    await waitFor(() => expect(screen.getAllByTestId("bubble")).toHaveLength(6));
    expect(screen.getAllByTestId("bubble").map((b) => b.dataset.kind)).toEqual([
      "search",
      "vote",
      "vote",
      "vote",
      "vote",
      "final",
    ]);
  });

  it("styles off kind and nothing else", async () => {
    render(<Transcript turns={runResult.transcript} revealMs={1} />);
    await waitFor(() => expect(screen.getAllByTestId("bubble")).toHaveLength(6));
    const [first, , , , , last] = screen.getAllByTestId("bubble");
    expect(first).toHaveClass("bubble--search");
    expect(last).toHaveClass("bubble--final");
  });

  it("labels each turn with its speaker", async () => {
    render(<Transcript turns={runResult.transcript} revealMs={1} />);
    await waitFor(() => expect(screen.getByText("Nazar")).toBeInTheDocument());
    expect(screen.getAllByText("Orchestrator")).toHaveLength(2);
  });

  it("renders nothing for an empty transcript", () => {
    render(<Transcript turns={[]} revealMs={1} />);
    expect(screen.queryAllByTestId("bubble")).toHaveLength(0);
  });
});
