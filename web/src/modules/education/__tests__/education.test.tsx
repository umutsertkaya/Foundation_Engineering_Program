import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../../app/i18n";
import { TOPICS } from "../content";
import { FIGURES } from "../figures";
import Root from "../Root";

afterEach(cleanup);

const renderAt = (path: string) =>
  render(
    <MantineProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/*" element={<Root />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );

describe("education module", () => {
  it("lists every topic on the home page", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: i18n.t("education.home.heading") })).toBeInTheDocument();
    expect(TOPICS.length).toBeGreaterThanOrEqual(7);
    for (const tp of TOPICS) expect(screen.getByText(tp.title.tr)).toBeInTheDocument();
  });

  it("has a figure for every figure block and unique topic ids", () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    for (const tp of TOPICS) {
      expect(tp.sources.length).toBeGreaterThan(0);
      expect(tp.codeRefs.length).toBeGreaterThan(0);
      for (const b of tp.blocks) if (b.type === "figure") expect(FIGURES[b.id], b.id).toBeDefined();
    }
  });

  it.each(TOPICS.map((t) => [t.id, t.title.tr]))("renders topic %s with its figures", (id, title) => {
    const { container } = renderAt(`/topic/${id}`);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    const tp = TOPICS.find((t) => t.id === id)!;
    const n = tp.blocks.filter((b) => b.type === "figure").length;
    expect(container.querySelectorAll("figure svg").length).toBe(n);
  });
});
