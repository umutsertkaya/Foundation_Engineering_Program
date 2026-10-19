import { useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import trCatalog from "../../../../../geotek/modules/walls/i18n/tr.json";
import { AnalysisOptionsForm } from "../components/AnalysisOptionsForm";
import { ANALYSIS_DEFAULTS } from "../settings";
import type { AnalysisOptions } from "../types";
import { renderThemed } from "./helpers";

const tr = trCatalog as Record<string, string>;

function Harness(props: {
  initial?: Partial<AnalysisOptions>;
  level?: "basic" | "advanced";
  missing?: string[];
  onChange?: (v: AnalysisOptions) => void;
  onGoToSoil?: () => void;
}) {
  const [value, setValue] = useState<AnalysisOptions>({ ...ANALYSIS_DEFAULTS, ...props.initial });
  const [confirmed, setConfirmed] = useState(false);
  return (
    <AnalysisOptionsForm
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
      level={props.level ?? "advanced"}
      missingPermeability={props.missing ?? []}
      passiveConfirmed={confirmed}
      onConfirmPassive={setConfirmed}
      onGoToSoil={props.onGoToSoil}
    />
  );
}

describe("AnalysisOptionsForm", () => {
  it("shows the model defaults and explains each option", () => {
    renderThemed(<Harness />);
    expect(screen.getByRole("radio", { name: tr["walls.options.kv.envelope"] })).toBeChecked();
    expect(screen.getByRole("radio", { name: tr["walls.options.submerged.envelope"] })).toBeChecked();
    expect(screen.getByRole("radio", { name: tr["walls.options.uplift.overturning"] })).toBeChecked();
    expect(screen.getByLabelText(new RegExp(tr["walls.options.gwt_bearing.label"]))).toBeChecked();
    expect(screen.getByText(tr["walls.options.kv.hint"])).toBeInTheDocument();
    expect(screen.getByText(tr["walls.options.submerged.by_permeability.desc"])).toBeInTheDocument();
    expect(screen.getByText(tr["walls.options.uplift.overturning.desc"])).toBeInTheDocument();
  });

  it("writes kv sign, submerged mode, uplift moment and the groundwater correction", () => {
    const onChange = vi.fn();
    renderThemed(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: tr["walls.options.kv.down"] }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ kv_sign: "down" }));
    fireEvent.click(screen.getByRole("radio", { name: tr["walls.options.submerged.by_permeability"] }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kv_sign: "down", submerged_seismic: "by_permeability" }),
    );
    fireEvent.click(screen.getByRole("radio", { name: tr["walls.options.uplift.resisting"] }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ uplift_moment: "resisting" }));
    fireEvent.click(screen.getByLabelText(new RegExp(tr["walls.options.gwt_bearing.label"])));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ gwt_bearing_correction: false }));
  });

  it("lists layers without k for the by-permeability mode and links to the soil step", () => {
    const onGoToSoil = vi.fn();
    renderThemed(<Harness initial={{ submerged_seismic: "by_permeability" }} missing={["F2", "L1"]} onGoToSoil={onGoToSoil} />);
    expect(screen.getByTestId("permeability-status")).toHaveTextContent("F2, L1");
    fireEvent.click(screen.getByRole("button", { name: tr["walls.options.submerged.go_soil"] }));
    expect(onGoToSoil).toHaveBeenCalled();
  });

  it("does not show the permeability status for the other modes", () => {
    renderThemed(<Harness initial={{ submerged_seismic: "pervious" }} missing={["F2"]} />);
    expect(screen.queryByTestId("permeability-status")).toBeNull();
  });

  it("shows the passive reduction as an engineer-confirmed value that must be confirmed", () => {
    const onChange = vi.fn();
    renderThemed(<Harness initial={{ use_passive: true }} onChange={onChange} />);
    const input = screen.getByTestId("passive-reduction") as HTMLInputElement;
    expect(input).toHaveValue("0.5");
    expect(screen.getByText(tr["walls.options.passive.engineer_badge"])).toBeInTheDocument();
    expect(screen.getByText(tr["walls.options.passive.desc"])).toBeInTheDocument();
    expect(screen.getByTestId("passive-confirmation")).toHaveTextContent("0.50");
    expect(screen.getByTestId("passive-confirmation")).toHaveTextContent("henüz onaylanmadı");

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByTestId("passive-confirmation")).toHaveTextContent("onaylandı");

    // editing the value withdraws the confirmation
    fireEvent.change(input, { target: { value: "0.3" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ passive_reduction: 0.3 }));
    expect(screen.getByTestId("passive-confirmation")).toHaveTextContent("henüz onaylanmadı");
  });

  it("ignores values outside (0, 1]", () => {
    const onChange = vi.fn();
    renderThemed(<Harness initial={{ use_passive: true }} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("passive-reduction"), { target: { value: "0" } });
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ passive_reduction: 0 }));
  });

  it("disables the passive controls at the basic level, where the engine ignores them", () => {
    renderThemed(<Harness level="basic" initial={{ use_passive: true }} />);
    expect(screen.getByTestId("passive-basic-note")).toBeInTheDocument();
    expect(screen.getByLabelText(tr["walls.options.passive.use"])).toBeDisabled();
    expect(screen.getByTestId("passive-reduction")).toBeDisabled();
    expect(screen.queryByTestId("passive-confirmation")).toBeNull();
    // the other options stay editable at the basic level (the service keeps them)
    expect(screen.getByRole("radio", { name: tr["walls.options.kv.up"] })).toBeEnabled();
  });

  it("leaves no untranslated key on screen", () => {
    renderThemed(<Harness initial={{ use_passive: true, submerged_seismic: "by_permeability" }} missing={["F2"]} />);
    expect(document.body.textContent).not.toMatch(/walls\.[a-z_]+\./);
  });
});
