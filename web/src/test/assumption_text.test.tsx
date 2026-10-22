import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import i18n from "../app/i18n";
import { useAssumptionText } from "../shared/hooks/useAssumptionText";

describe("useAssumptionText", () => {
  it("renders coded wall assumptions in the UI language and keeps uncoded text", async () => {
    const { result } = renderHook(() => useAssumptionText());
    const item = { text: "Beton birim hacim ağırlığı 24 kN/m³", code: "wall.concrete_unit_weight", params: { value: "24" } };
    await i18n.changeLanguage("en");
    expect(result.current(item)).toBe("Concrete unit weight 24 kN/m³");
    await i18n.changeLanguage("tr");
    expect(result.current(item)).toBe("Beton birim hacim ağırlığı 24 kN/m³");
    expect(result.current({ text: "serbest metin" })).toBe("serbest metin");
    expect(result.current({ text: "ham", code: "wall.unknown_code" })).toBe("ham");
  });
});
