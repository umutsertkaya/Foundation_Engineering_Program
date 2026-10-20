import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../../app/i18n";
import type { SheetPileResultDTO } from "../../../shared/api/types";
import { ResultPanel } from "../components/ResultPanel";
import tr from "../../../../../geotek/modules/sheet_pile/i18n/tr.json";
import en from "../../../../../geotek/modules/sheet_pile/i18n/en.json";

function result(): SheetPileResultDTO {
  return {
    structure_id: "contract", support: "anchored", H: 4, D0: 2, D: 2,
    total_length: 6, anchor_depth: 1, anchor_force: 100, toe_force: null,
    anchor_force_per_anchor: 258.819, anchor_spacing_used: 2.5, anchor_inclination_used: 15,
    M_max: 120, z_M_max: 3, z: [], shear: [], moment: [], net: [], section_modulus_cm3: 750,
    warnings: ["Legacy English warning"],
    warning_items: [{ code: "sheet_pile.tension_crack", params: { depth: 1.25 } }],
    assumptions: [{ text: "Legacy English assumption", source: "source",
      code: "sheet_pile.passive_factor", params: { factor: 1.5 } }],
  };
}

function show(value: SheetPileResultDTO) {
  return render(<MantineProvider><ResultPanel result={value} /></MantineProvider>);
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("tr");
});

describe("sheet_pile translated result contract", () => {
  it.each([
    ["tr", "1.25 m derinliğe kadar çekme bölgesi sıfırlandı (çekme çatlağı)",
      "Pasif basınç GS=1.5 ile bölündü", "Ankraj başına yük", "258,82", "Aralık: 2,50 m; eğim: 15,00°", "kN/ankraj"],
    ["en", "Tension zone to 1.25 m set to zero (tension crack)",
      "Passive pressure divided by FS=1.5", "Load per anchor", "258.82", "Spacing: 2.50 m; inclination: 15.00°", "kN per anchor"],
  ])("renders translated warnings, assumptions and per-anchor load in %s", async (lang, warning, assumption, label, load, geometry, unit) => {
    await i18n.changeLanguage(lang);
    show(result());
    expect(screen.getByText(warning)).toBeInTheDocument();
    expect(screen.getByText(assumption, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Legacy English warning")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy English assumption")).not.toBeInTheDocument();
    const box = screen.getByTestId("per-anchor-load");
    expect(box).toHaveTextContent(label);
    expect(box).toHaveTextContent(load);
    expect(box).toHaveTextContent(geometry);
    expect(box).toHaveTextContent(unit);
  });

  it("keeps generic diagnostics and uncoded assumptions readable", () => {
    const value = result();
    value.warning_items = [{ code: "generic", params: { text: "Future warning" } }];
    value.assumptions = [{ text: "Existing assumption", source: "source" }];
    show(value);
    expect(screen.getByText("Future warning")).toBeInTheDocument();
    expect(screen.getByText("Existing assumption", { exact: false })).toBeInTheDocument();
  });

  it("uses legacy warnings for stored results without warning_items and hides per-anchor box for cantilevers", () => {
    const value = result();
    delete value.warning_items;
    value.support = "cantilever";
    show(value);
    expect(screen.getByText("Legacy English warning")).toBeInTheDocument();
    expect(screen.queryByTestId("per-anchor-load")).not.toBeInTheDocument();
  });

  it("keeps TR/EN keys and interpolation parameters in parity", () => {
    expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(tr) as (keyof typeof tr)[]) {
      const params = (text: string) => [...text.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]).sort();
      expect(params(tr[key])).toEqual(params(en[key]));
    }
  });
});
