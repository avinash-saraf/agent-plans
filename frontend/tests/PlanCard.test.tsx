import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanCard } from "../src/components/PlanCard.tsx";
import { runResult } from "./fixtures.ts";

describe("PlanCard", () => {
  it("shows each step as a real, clickable link", () => {
    render(<PlanCard plan={runResult.plan!} />);
    const link = screen.getByRole("link", { name: "Veracruz All Natural" });
    expect(link).toHaveAttribute("href", "https://www.veracruzallnatural.com/");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("keeps the steps in order", () => {
    render(<PlanCard plan={runResult.plan!} />);
    const times = screen.getAllByText(/pm$/).map((el) => el.textContent);
    expect(times).toEqual(["7:00pm", "9:00pm"]);
  });

  it("gives the compromise its own place in the layout", () => {
    render(<PlanCard plan={runResult.plan!} />);
    expect(screen.getByText(/Sam gave up the quiet night/)).toBeInTheDocument();
    expect(screen.getByText("who compromised")).toBeInTheDocument();
  });
});
