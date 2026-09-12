import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Picks } from "../src/components/Picks.tsx";
import { runResult } from "./fixtures.ts";

const picks = runResult.picks!;

describe("Picks", () => {
  it("shows every spot as a real, clickable link", () => {
    render(<Picks picks={picks} />);
    const link = screen.getByRole("link", { name: "Veracruz All Natural" });
    expect(link).toHaveAttribute("href", "https://www.veracruzallnatural.com/");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("gives each spot both sides, labelled", () => {
    render(<Picks picks={picks} />);
    for (const item of screen.getAllByRole("listitem")) {
      expect(within(item).getByText("works for")).toBeInTheDocument();
      expect(within(item).getByText("not for")).toBeInTheDocument();
    }
  });

  it("names who a spot works for and who it does not", () => {
    render(<Picks picks={picks} />);
    expect(screen.getByText(/Maya and Nazar/)).toBeInTheDocument();
    expect(screen.getByText(/Dev\. It is a taco trailer/)).toBeInTheDocument();
  });

  it("renders no times, no step numbers and no ordering language", () => {
    const { container } = render(<Picks picks={picks} />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\d{1,2}:\d{2}\s*(am|pm)/i);
    expect(text).not.toMatch(/\bstart here\b|\bthen head\b|\bafterwards\b|\bstep \d/i);
  });

  it("uses an unordered list, because the spots have no order", () => {
    const { container } = render(<Picks picks={picks} />);
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelector("ol")).toBeNull();
  });

  it("says how many spots there are", () => {
    render(<Picks picks={picks} />);
    expect(screen.getByText(`${picks.length} spots worth your time`)).toBeInTheDocument();
  });
});
