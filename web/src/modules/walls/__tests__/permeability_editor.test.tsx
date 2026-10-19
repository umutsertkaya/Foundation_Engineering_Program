import { useState } from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import trCatalog from "../../../../../geotek/modules/walls/i18n/tr.json";
import type { StructureSoilModel } from "../../../shared/api/types";
import { PermeabilityEditor } from "../components/PermeabilityEditor";
import { layerPermeability, withPermeability } from "../settings";
import { layer, renderThemed, soilModel } from "./helpers";

const tr = trCatalog as Record<string, string>;

function Harness({ initial, onChange }: { initial: StructureSoilModel; onChange?: (s: StructureSoilModel) => void }) {
  const [soil, setSoil] = useState(initial);
  return (
    <PermeabilityEditor
      soil={soil}
      onChange={(s) => {
        setSoil(s);
        onChange?.(s);
      }}
    />
  );
}

const input = (id: string) => screen.getByLabelText(tr["walls.perm.input_label"].replace("{id}", id));

describe("PermeabilityEditor", () => {
  const soil = soilModel({
    fill: [layer("F1", 0, 2), withPermeability(layer("F2", 2, 4), 1e-6)],
    layers: [layer("L1", 0, 6), layer("L2", 6, 12)],
  });

  it("lists fill and profile layers with their stored k and class", () => {
    renderThemed(<Harness initial={soil} />);
    expect(screen.getAllByTestId("permeability-row").map((r) => r.getAttribute("data-layer-id"))).toEqual([
      "F1",
      "F2",
      "L1",
      "L2",
    ]);
    expect(input("F2")).toHaveValue("1e-6");
    expect(input("F1")).toHaveValue("");
    // k only: no classification or threshold is shown
    expect(document.body.textContent).not.toMatch(/geçirimsiz|geçirimli sayılır|5·10|5e-4/);
  });

  it("commits a valid k to a fill layer and a profile layer without touching the others", () => {
    const onChange = vi.fn();
    renderThemed(<Harness initial={soil} onChange={onChange} />);
    fireEvent.change(input("F1"), { target: { value: "2.5e-3" } });
    fireEvent.blur(input("F1"));
    let next = onChange.mock.calls.at(-1)![0] as StructureSoilModel;
    expect(layerPermeability(next.retained_fill![0])).toBe(2.5e-3);
    expect(layerPermeability(next.retained_fill![1])).toBe(1e-6);

    fireEvent.change(input("L2"), { target: { value: "1e-7" } });
    fireEvent.keyDown(input("L2"), { key: "Enter" });
    next = onChange.mock.calls.at(-1)![0] as StructureSoilModel;
    expect(layerPermeability(next.profile.layers[1])).toBe(1e-7);
    expect(layerPermeability(next.profile.layers[0])).toBeNull();
    // the layer keeps its other fields
    expect(next.profile.layers[1].gamma).toBe(19);
  });

  it("clears k when the cell is emptied", () => {
    const onChange = vi.fn();
    renderThemed(<Harness initial={soil} onChange={onChange} />);
    fireEvent.change(input("F2"), { target: { value: "" } });
    fireEvent.blur(input("F2"));
    const next = onChange.mock.calls.at(-1)![0] as StructureSoilModel;
    expect(layerPermeability(next.retained_fill![1])).toBeNull();
  });

  it("an invalid entry is cleared explicitly (never silently keeps the old value) and says so", () => {
    const onChange = vi.fn();
    renderThemed(<Harness initial={soil} onChange={onChange} />);
    // no stored k: stays "not entered", with the explanation
    fireEvent.change(input("F1"), { target: { value: "abc" } });
    fireEvent.blur(input("F1"));
    expect(input("F1")).toHaveValue("");
    expect(screen.getAllByText(tr["walls.perm.invalid_cleared"])).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
    // stored k: the invalid entry removes it from the soil and shows the message
    for (const bad of ["0", "-1e-5"]) {
      fireEvent.change(input("F2"), { target: { value: bad } });
      fireEvent.blur(input("F2"));
      expect(input("F2")).toHaveValue("");
    }
    const next = onChange.mock.calls.at(-1)![0] as StructureSoilModel;
    expect(layerPermeability(next.retained_fill![1])).toBeNull();
    expect(screen.getAllByText(tr["walls.perm.invalid_cleared"]).length).toBeGreaterThan(0);
  });
});
