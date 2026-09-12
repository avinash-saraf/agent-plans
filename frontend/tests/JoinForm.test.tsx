import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JoinForm } from "../src/components/JoinForm.tsx";

describe("JoinForm", () => {
  it("is one name field and one freeform textarea — no preference schema", () => {
    render(<JoinForm onJoin={vi.fn()} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("stays disabled until both fields have content", async () => {
    const user = userEvent.setup();
    render(<JoinForm onJoin={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("your name"), "Maya");
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/what should your agent know/), "vegan");
    expect(button).toBeEnabled();
  });

  it("submits trimmed values and then clears", async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn().mockResolvedValue(undefined);
    render(<JoinForm onJoin={onJoin} />);

    await user.type(screen.getByLabelText("your name"), "  Maya  ");
    await user.type(screen.getByLabelText(/what should your agent know/), "  vegan, won't budge  ");
    await user.click(screen.getByRole("button"));

    expect(onJoin).toHaveBeenCalledWith("Maya", "vegan, won't budge");
    expect(screen.getByLabelText("your name")).toHaveValue("");
  });

  it("does not submit whitespace", async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<JoinForm onJoin={onJoin} />);
    await user.type(screen.getByLabelText("your name"), "   ");
    await user.type(screen.getByLabelText(/what should your agent know/), "   ");
    expect(screen.getByRole("button")).toBeDisabled();
    expect(onJoin).not.toHaveBeenCalled();
  });
});
