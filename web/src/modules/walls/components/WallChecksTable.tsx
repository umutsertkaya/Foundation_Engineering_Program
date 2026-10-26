import { Badge, Box, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { CheckDTO, WallResultDTO } from "../../../shared/api/types";
import { checkKey, checkNameLabel, comboLabel, deriveGoverning, splitCase } from "../labels";
import { formatCheckValue, formatQuantity } from "./WallCheckCards";

/**
 * How many times the requirement is met: value / required for a ">=" check, limit / value for a "<=" check.
 * 1 means exactly at the requirement; null when the result holds no usable number for it.
 */
export function marginRatio(check: Pick<CheckDTO, "value" | "required" | "comparison" | "passed">): number | null {
  if (check.comparison === ">=") {
    if (check.value === null) return check.passed ? Number.POSITIVE_INFINITY : null;
    return check.required > 0 ? Math.max(0, check.value / check.required) : null;
  }
  if (check.value === null || check.required < 0) return null;
  return check.value <= 0 ? Number.POSITIVE_INFINITY : check.required / check.value;
}

/** A passed check whose margin is below this ratio is drawn in the warning colour. */
export const TIGHT_MARGIN = 1.1;

/** Bar with a mark at the required value (always at 50 %): the fill passes the mark when the check holds. */
function RequirementBar({ check }: { check: CheckDTO }) {
  const ratio = marginRatio(check);
  const fill = ratio === null ? 0 : Math.min(100, ratio * 50);
  const tone = !check.passed ? "bad" : ratio !== null && ratio < TIGHT_MARGIN ? "warn" : "ok";
  return (
    <Box
      aria-hidden="true"
      data-field="bar"
      data-tone={tone}
      style={{ position: "relative", height: 8, borderRadius: 999, background: "var(--gt-neutral-bg)" }}
    >
      <Box
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill}%`, borderRadius: 999, background: `var(--gt-${tone}-dot)` }}
      />
      <Box style={{ position: "absolute", left: "50%", top: -4, bottom: -4, width: 2, background: "var(--mantine-color-text)" }} />
    </Box>
  );
}

function CheckCell({ check, governing }: { check: CheckDTO; governing: boolean }) {
  const { t } = useTranslation();
  const { combo } = splitCase(check.case);
  const kvSign = check.kv_sign ?? null;
  return (
    <Box
      data-testid="check-cell"
      data-check-key={checkKey(check)}
      data-passed={check.passed}
      data-governing={governing || undefined}
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      <Box style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <Text component="b" ff="monospace" fz={18} fw={500} data-field="value">
          {formatCheckValue(check)}
        </Text>
        <Text component="span" fz={12} c="dimmed" data-field="required">
          {t(check.comparison === ">=" ? "walls.table.required" : "walls.table.limit", { value: formatQuantity(check.required) })}
        </Text>
        {!check.passed && (
          <Badge size="xs" color="red" variant="light" style={{ overflow: "visible" }}>
            {t("ui.not_ok")}
          </Badge>
        )}
        {kvSign !== null && (
          <Badge size="xs" variant="outline" color="grape" style={{ overflow: "visible" }} data-kv-sign={kvSign} title={t("walls.result.kv_governing_hint")}>
            {t(`walls.result.kv_${kvSign}`)}
          </Badge>
        )}
      </Box>
      <RequirementBar check={check} />
      {combo !== null && (
        <Text fz={11} c="dimmed">
          {comboLabel(combo, t)}
        </Text>
      )}
    </Box>
  );
}

const GRID = "minmax(110px, 150px) minmax(0, 1fr) minmax(0, 1fr)";

export interface WallChecksTableProps {
  result: Pick<WallResultDTO, "checks" | "passed" | "governing_check_ids" | "minimum_width_governs">;
}

/**
 * Checks of a result as one row per check name with a static and a seismic column. Every cell shows the value,
 * the required value and a bar with a mark at the required value; a cell exists only for checks the result holds.
 */
export function WallChecksTable({ result }: WallChecksTableProps) {
  const { t } = useTranslation();
  const governing = new Set(deriveGoverning(result).keys);
  const names = [...new Set(result.checks.map((c) => c.name))];
  const cellChecks = (name: string, state: "static" | "seismic") =>
    result.checks.filter((c) => c.name === name && (splitCase(c.case).state === "static") === (state === "static"));
  return (
    <Box data-testid="checks-table" role="table" aria-label={t("walls.table.title")}>
      <Box role="row" style={{ display: "grid", gridTemplateColumns: GRID, gap: 18, paddingBottom: 4 }}>
        <span role="columnheader" />
        <Text role="columnheader" fz={12} c="dimmed">{t("case.static")}</Text>
        <Text role="columnheader" fz={12} c="dimmed">{t("case.seismic")}</Text>
      </Box>
      {names.map((name) => (
        <Box
          key={name}
          role="row"
          data-testid="check-row"
          style={{ display: "grid", gridTemplateColumns: GRID, gap: 18, alignItems: "center", padding: "14px 0", borderTop: "1px solid var(--gt-border-soft)" }}
        >
          <Text role="rowheader" fw={500}>{checkNameLabel(name, t)}</Text>
          {(["static", "seismic"] as const).map((state) => {
            const cells = cellChecks(name, state);
            return (
              <Box key={state} role="cell" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                {cells.length === 0 ? (
                  <Text c="dimmed" fz={13}>{t("web.common.none")}</Text>
                ) : (
                  cells.map((check) => <CheckCell key={checkKey(check)} check={check} governing={governing.has(checkKey(check))} />)
                )}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
