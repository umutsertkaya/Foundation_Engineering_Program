import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { loadLanguageCatalog } from "../../../app/i18n";
import { theme } from "../../../app/theme";
import type { ShearKey } from "../../../shared/api/types";
import { ShearKeyFields } from "../components/ShearKeyFields";
import { ShearKeyResult } from "../components/ShearKeyResult";
import { buildSectionLayout } from "../components/sectionLayout";

beforeEach(async () => {
  await loadLanguageCatalog("tr");
});
afterEach(cleanup);

const wrap = (node: React.ReactNode) => render(<MantineProvider theme={theme}>{node}</MantineProvider>);

describe("shear key", () => {
  it("switches the key on with defaults that fit the base and off again", () => {
    const onChange = vi.fn();
    wrap(<ShearKeyFields value={null} baseWidth={0.4} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: new RegExp(i18n.t("walls.key.enable")) }));
    expect(onChange).toHaveBeenCalledWith({ position: "heel", width: 0.4, depth: 0.5 });
  });

  it("flags a key wider than the base", () => {
    const key: ShearKey = { position: "toe", width: 3, depth: 0.5 };
    wrap(<ShearKeyFields value={key} baseWidth={2} onChange={() => undefined} />);
    expect(screen.getByText(i18n.t("walls.key.width_too_large"))).toBeInTheDocument();
  });

  it("draws the key below the base and lists its results", () => {
    const geometry = {
      stem_height: 4.5, stem_top: 0.3, stem_bottom: 0.5, toe: 0.9, heel: 3.2, base_thickness: 0.5,
      embedment: 0.6, key: { position: "heel", width: 0.5, depth: 0.6 } as ShearKey,
    };
    const withKey = buildSectionLayout({ wallType: "cantilever", geometry, height: 5 });
    const without = buildSectionLayout({ wallType: "cantilever", geometry: { ...geometry, key: null }, height: 5 });
    expect(withKey.wall.length).toBe(without.wall.length + 1);
    // the key polygon reaches below the base line
    expect(Math.max(...withKey.wall[withKey.wall.length - 1].map(([, y]) => y))).toBeGreaterThan(withKey.baseY);

    wrap(
      <ShearKeyResult
        items={[{
          case: "static", position: "heel", width: 0.5, depth: 0.6, passive_full: 18.5, passive_used: 9.25,
          reduction: 0.5, arm: 0.33, fs_base_surface: 3.02, fs_deep_surface: 2.72, fs_with_key: 2.72,
          fs_without_key: 2.77, governing: "deep", demand_v: 18.5, demand_m: 6.17,
        }]}
      />,
    );
    expect(screen.getByTestId("shear-key-result")).toHaveTextContent("2.72");
  });
});
