import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import trCatalog from "../../../../../geotek/i18n/tr.json";
import wallsTr from "../../../../../geotek/modules/walls/i18n/tr.json";
import { WallCheckCards, formatQuantity } from "../components/WallCheckCards";
import { WallResultView } from "../components/WallResultView";
import { check, CANTILEVER, renderThemed, result, soilModel } from "./helpers";

const tr = { ...trCatalog, ...wallsTr } as Record<string, string>;

const CHECKS = [
  check("static:TBDY-static", "sliding", 2.0, 1.1, ">=", "V tan(30) + c_a B"),
  check("seismic:TBDY-seismic", "bearing", 1.45, 1.4, ">=", "kv yukarı: q_ult / q_max"),
  check("seismic:TBDY-seismic", "overturning", 2.8, 1.3, ">=", "kv aşağı: M_R / M_O"),
  check("seismic:TBDY-seismic", "eccentricity", 0.2, 0.333, "<=", "e/B"),
];

describe("WallCheckCards", () => {
  it("shows demand, limit, ratio and pass/fail per check with readable labels (no raw ids)", () => {
    renderThemed(<WallCheckCards result={result({ checks: CHECKS })} mode="check" />);
    const cards = screen.getAllByTestId("check-card");
    expect(cards).toHaveLength(4);

    const sliding = cards[0];
    expect(within(sliding).getByText(tr["check.sliding"])).toBeInTheDocument();
    expect(within(sliding).getByText(tr["case.static"])).toBeInTheDocument();
    expect(within(sliding).getByText(tr["walls.term.TBDY-static"])).toBeInTheDocument();
    expect(sliding.querySelector('[data-field="value"]')).toHaveTextContent("2.00");
    expect(sliding.querySelector('[data-field="required"]')).toHaveTextContent("≥ 1.10");
    expect(sliding.querySelector('[data-field="ratio"]')).toHaveTextContent("55%");
    expect(within(sliding).getByText(tr["ui.ok"])).toBeInTheDocument();

    const ecc = cards[3];
    expect(within(ecc).getByText(tr["walls.result.limit_max"])).toBeInTheDocument();
    expect(ecc.querySelector('[data-field="required"]')).toHaveTextContent("≤ 0.333");

    expect(document.body.textContent).not.toMatch(/seismic:|static:|TBDY-seismic|check\.|case\./);
  });

  it("highlights the most critical check when the engine reports nothing governing", () => {
    renderThemed(<WallCheckCards result={result({ checks: CHECKS, governing: "" })} mode="check" />);
    const governing = screen.getAllByTestId("check-card").filter((c) => c.hasAttribute("data-governing"));
    expect(governing).toHaveLength(1);
    expect(governing[0]).toHaveAttribute("data-check-key", "seismic:TBDY-seismic:bearing");
    expect(within(governing[0]).getByText(tr["walls.governing.critical"])).toBeInTheDocument();
    expect(screen.getByTestId("governing-summary")).toHaveTextContent(
      `${tr["case.seismic"]} · ${tr["walls.term.TBDY-seismic"]} · ${tr["check.bearing"]}`,
    );
  });

  it("highlights every failing check and names the verdict", () => {
    const failing = [check("static", "sliding", 1.2, 1.5), check("seismic", "bearing", 1.0, 1.4), check("static", "bearing", 4, 3)];
    renderThemed(
      <WallCheckCards result={result({ checks: failing, passed: false, governing: "static:sliding, seismic:bearing" })} mode="check" />,
    );
    const keys = screen
      .getAllByTestId("check-card")
      .filter((c) => c.hasAttribute("data-governing"))
      .map((c) => c.getAttribute("data-check-key"));
    expect(keys).toEqual(["static:sliding", "seismic:bearing"]);
    expect(screen.getByTestId("governing-summary")).toHaveTextContent(tr["walls.governing.failing_line"].split("{label}")[0]);
    expect(screen.getAllByText(tr["ui.not_ok"])).toHaveLength(2);
  });

  it("shows which kv sign governed in envelope mode and strips the prefix from the detail", () => {
    renderThemed(<WallCheckCards result={result({ checks: CHECKS })} mode="check" />);
    const cards = screen.getAllByTestId("check-card");
    expect(cards[0].querySelector("[data-kv-sign]")).toBeNull();
    expect(cards[1].querySelector("[data-kv-sign]")).toHaveAttribute("data-kv-sign", "up");
    expect(cards[1]).toHaveTextContent(tr["walls.result.kv_up"]);
    expect(cards[2].querySelector("[data-kv-sign]")).toHaveAttribute("data-kv-sign", "down");
    expect(cards[2]).toHaveTextContent(tr["walls.result.kv_down"]);
    expect(cards[1]).toHaveTextContent("q_ult / q_max");
    expect(cards[1]).not.toHaveTextContent("kv yukarı:");
    expect(screen.getByTestId("kv-envelope-note")).toBeInTheDocument();
  });

  it("shows no kv badge and no envelope note when a single sign was used", () => {
    const plain = CHECKS.map((c) => ({ ...c, detail: c.detail.replace(/^kv (yukarı|aşağı): /, "") }));
    renderThemed(<WallCheckCards result={result({ checks: plain })} mode="check" />);
    expect(document.querySelectorAll("[data-kv-sign]")).toHaveLength(0);
    expect(screen.queryByTestId("kv-envelope-note")).toBeNull();
  });

  it("labels the sizing-governing check when a size run succeeded", () => {
    renderThemed(
      <WallCheckCards result={result({ checks: CHECKS, governing: "seismic:TBDY-seismic:overturning" })} mode="suggest" />,
    );
    const card = screen.getAllByTestId("check-card").find((c) => c.hasAttribute("data-governing"))!;
    expect(card).toHaveAttribute("data-check-key", "seismic:TBDY-seismic:overturning");
    expect(within(card).getByText(tr["walls.governing.sizing"])).toBeInTheDocument();
  });

  it("formats undefined and small quantities", () => {
    expect(formatQuantity(null)).toBe("∞");
    expect(formatQuantity(0.1667)).toBe("0.167");
    expect(formatQuantity(1.456)).toBe("1.46");
  });
});

describe("WallResultView", () => {
  it("translates factor paths for every design code and keeps the raw path as a tooltip", () => {
    const r = result({
      checks: CHECKS,
      factors_used: [
        { path: "TBDY-seismic.resistance.overturning", value: 1.3, source: "TBDY", status: "verified" },
        { path: "safety.bearing_capacity.static", value: 3, source: "ASD", status: "unverified" },
        { path: "load.DC.max", value: 1.25, source: "AASHTO", status: "secondary" },
        { path: "DA1-C2.material.tan_phi", value: 1.25, source: "EC7", status: "verified" },
      ],
      warnings: ["Düşey deprem katsayısı ±kv zarfı uygulandı"],
    });
    renderThemed(
      <WallResultView result={r} mode="check" wallType="cantilever" height={5} backfillSlope={0} soil={soilModel()} gwtCase="design" />,
    );
    const rows = document.querySelectorAll("tbody tr");
    const text = Array.from(rows).map((row) => row.textContent ?? "");
    expect(text.some((x) => x.includes("TBDY depremli birleşim › Direnç katsayıları › Devrilme"))).toBe(true);
    expect(text.some((x) => x.includes("Güvenlik sayıları › Taşıma gücü › Statik"))).toBe(true);
    expect(text.some((x) => x.includes("Yük katsayıları › DC (yapı öz ağırlığı) › maks."))).toBe(true);
    expect(text.some((x) => x.includes("DA1 Kombinasyon 2 (A2+M2+R1) › Malzeme katsayıları › tan φ'"))).toBe(true);
    expect(screen.getByTitle("TBDY-seismic.resistance.overturning")).toBeInTheDocument();
    expect(screen.getByTestId("result-warnings")).toHaveTextContent("±kv zarfı");
    expect(screen.getByTestId("wall-section")).toBeInTheDocument();
  });
});
