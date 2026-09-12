import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.tsx";
import { runResult } from "./fixtures.ts";

/** Stands in for the backend so the frontend is testable on its own. */
const stubApi = () => {
  const members: { id: string; name: string; context: string }[] = [];
  const calls: string[] = [];

  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    calls.push(`${init?.method ?? "GET"} ${href}`);

    if (href.endsWith("/members") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { name: string; context: string };
      const member = { id: `m${members.length + 1}`, ...body };
      members.push(member);
      return new Response(JSON.stringify({ member }), { status: 201 });
    }
    if (href.endsWith("/members")) {
      return new Response(JSON.stringify({ members }), { status: 200 });
    }
    if (href.includes("/plan")) {
      return new Response(JSON.stringify(runResult), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls, members };
};

beforeEach(() => {
  stubApi();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("shows the group slug, because the link is the access model", async () => {
    render(<App slug="hackathon" revealMs={1} />);
    expect(await screen.findByText("/g/hackathon")).toBeInTheDocument();
  });

  it("starts empty and adds a member after joining", async () => {
    const user = userEvent.setup();
    render(<App slug="hackathon" revealMs={1} />);
    expect(await screen.findByText("nobody yet. you first.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("your name"), "Maya");
    await user.type(screen.getByLabelText(/what should your agent know/), "vegan, won't budge");
    await user.click(screen.getByRole("button", { name: /join the group/i }));

    expect(await screen.findByText("Maya")).toBeInTheDocument();
  });

  it("runs the plan on a button press and renders the transcript then the plan", async () => {
    const user = userEvent.setup();
    render(<App slug="hackathon" revealMs={1} />);

    await user.click(await screen.findByRole("button", { name: /find us some spots/i }));

    await waitFor(() => expect(screen.getAllByTestId("bubble")).toHaveLength(6));
    expect(screen.getByRole("link", { name: "Mohawk Austin" })).toBeInTheDocument();
    expect(screen.getAllByText("works for")).toHaveLength(3);
    expect(screen.getByText(/Dev\. It is a taco trailer/)).toBeInTheDocument();
  });

  it("suggests spots without inventing an itinerary", async () => {
    const user = userEvent.setup();
    const { container } = render(<App slug="hackathon" revealMs={1} />);

    await user.click(await screen.findByRole("button", { name: /find us some spots/i }));
    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(3));

    const shown = container.querySelector(".picks")?.textContent ?? "";
    expect(shown).not.toMatch(/\d{1,2}:\d{2}\s*(am|pm)/i);
  });

  it("asks for the cached fixture when running in demo mode", async () => {
    const user = userEvent.setup();
    const { calls } = stubApi();
    render(<App slug="hackathon" demo revealMs={1} />);

    await user.click(await screen.findByRole("button", { name: /run the cached demo/i }));

    await waitFor(() => expect(calls.some((c) => c.includes("/plan?demo=1"))).toBe(true));
  });

  it("surfaces a failed run instead of rendering a half plan", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) =>
        String(url).includes("/plan")
          ? new Response(JSON.stringify({ error: "need at least 2 people before planning" }), { status: 400 })
          : new Response(JSON.stringify({ members: [] }), { status: 200 }),
      ),
    );

    render(<App slug="hackathon" revealMs={1} />);
    await user.click(await screen.findByRole("button", { name: /find us some spots/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("need at least 2 people");
    expect(screen.queryAllByTestId("bubble")).toHaveLength(0);
  });
});
