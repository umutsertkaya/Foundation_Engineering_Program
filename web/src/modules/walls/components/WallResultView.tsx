import type { ReactNode } from "react";
import { Badge, Box, Button, Group, Stack, Table, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { CantileverGeometry, CheckDTO, GravityGeometry, WallResultDTO, WallType } from "../../../shared/api/types";
import { DisclosureList, DisclosureRow } from "../../../shared/components/DisclosureRow";
import { SectionCard } from "../../../shared/components/SectionCard";
import { StatusChip } from "../../../shared/components/StatusChip";
import { VerdictBanner } from "../../../shared/components/VerdictBanner";
import { useAssumptionText } from "../../../shared/hooks/useAssumptionText";
import { useWarningText } from "../../../shared/hooks/useWarningText";
import { caseLabel, checkKey, checkKeyLabel, criticalCheck, deriveGoverning, factorPathLabel } from "../labels";
import { formatCheckValue, formatQuantity } from "./WallCheckCards";
import { ShearKeyResult } from "./ShearKeyResult";
import { WallChecksTable } from "./WallChecksTable";
import { WallCrossSection } from "./WallCrossSection";

export interface WallResultViewProps {
  result: WallResultDTO;
  /** The shown result no longer matches the current inputs, or its job did not complete. */
  stale?: boolean;
  staleReason?: "inputs" | "job";
  /** Called by the "go to dimensions" button of a failed verdict; the button is hidden without it. */
  onEditGeometry?: () => void;
  /** Called by the "run again" button of the stale notice; the button is hidden without it. */
  onRerun?: () => void;
}

/** Wall type and structure height H of a result geometry (cantilever: base + stem; gravity: its own height). */
export function resultSectionBasis(geometry: CantileverGeometry | GravityGeometry): { wallType: WallType; height: number } {
  return "stem_bottom" in geometry
    ? { wallType: "cantilever", height: geometry.base_thickness + geometry.stem_height }
    : { wallType: "gravity", height: geometry.height };
}

export function StaleNotice({ reason, onRerun }: { reason: "inputs" | "job"; onRerun?: () => void }) {
  const { t } = useTranslation();
  return (
    <div data-testid="result-stale">
      <VerdictBanner
        tone="warn"
        title={t(reason === "job" ? "walls.result.stale_job_title" : "walls.result.stale_inputs_title")}
        text={t(reason === "job" ? "walls.result.stale_job" : "walls.result.stale_inputs")}
        action={
          onRerun && (
            <Button size="compact-sm" onClick={onRerun}>
              {t("walls.result.rerun")}
            </Button>
          )
        }
      />
    </div>
  );
}

/** Verdict banner built only from the result's own checks and flag: all pass, the failing ones, or the least margin. */
export function WallVerdict({ result, onEditGeometry }: { result: WallResultDTO; onEditGeometry?: () => void }) {
  const { t } = useTranslation();
  const failing = result.checks.filter((c) => !c.passed);
  if (result.passed && failing.length === 0) {
    const tight: CheckDTO | null = criticalCheck(result.checks);
    return (
      <VerdictBanner
        tone="ok"
        title={t("walls.verdict.ok_title")}
        text={
          tight &&
          t(tight.comparison === ">=" ? "walls.verdict.margin_min" : "walls.verdict.margin_max", {
            label: checkKeyLabel(checkKey(tight), t),
            value: formatCheckValue(tight),
            required: formatQuantity(tight.required),
          })
        }
      />
    );
  }
  const labels = [...new Set(failing.map((c) => checkKeyLabel(checkKey(c), t)))];
  return (
    <VerdictBanner
      tone="bad"
      title={labels.length > 0 ? t("walls.verdict.bad_title", { list: labels.join("; ") }) : t("walls.verdict.bad_generic")}
      text={t("walls.verdict.bad_text")}
      action={
        onEditGeometry && (
          <Button variant="default" size="compact-sm" onClick={onEditGeometry}>
            {t("walls.verdict.go_geometry")}
          </Button>
        )
      }
    />
  );
}

const num = (v: number | null, d = 2) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(d));

function ForcesTable({ forces }: { forces: WallResultDTO["forces"] }) {
  const { t } = useTranslation();
  const cases = Object.entries(forces).filter(([, list]) => list.length > 0);
  return (
    <Stack gap="md" data-testid="forces-table">
      {cases.map(([caseId, list]) => (
        <Box key={caseId} style={{ overflowX: "auto" }}>
          <Text fw={600} size="sm" mb={4}>{caseLabel(caseId, t)}</Text>
          <Table withTableBorder withColumnBorders verticalSpacing={3} fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("walls.forces.col_name")}</Table.Th>
                <Table.Th>{t("walls.forces.col_fx")}</Table.Th>
                <Table.Th>{t("walls.forces.col_fy")}</Table.Th>
                <Table.Th>{t("walls.forces.col_x")}</Table.Th>
                <Table.Th>{t("walls.forces.col_y")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((f, i) => (
                <Table.Tr key={`${f.name}-${i}`}>
                  <Table.Td>{f.name.replace(/_/g, " ")}</Table.Td>
                  <Table.Td ff="monospace">{num(f.fx)}</Table.Td>
                  <Table.Td ff="monospace">{num(f.fy)}</Table.Td>
                  <Table.Td ff="monospace">{num(f.x)}</Table.Td>
                  <Table.Td ff="monospace">{num(f.y)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      ))}
    </Stack>
  );
}

/** Results screen: verdict, warnings, checks table with the section beside it, then collapsible details. */
export function WallResultView({ result, stale = false, staleReason = "inputs", onEditGeometry, onRerun }: WallResultViewProps) {
  const { t } = useTranslation();
  const warningText = useWarningText();
  const assumptionText = useAssumptionText();
  const basis = resultSectionBasis(result.geometry);
  const governing = deriveGoverning(result);
  const governingLine: ReactNode =
    governing.kind === "sizing" || governing.kind === "minimum_width"
      ? t(`walls.governing.${governing.kind}_line`, { label: governing.keys.map((k) => checkKeyLabel(k, t)).join("; ") })
      : null;
  const hasForces = Object.values(result.forces ?? {}).some((list) => list.length > 0);
  const shearKey = result.shear_key ?? [];

  return (
    <Stack gap="md" data-stale={stale || undefined}>
      {stale && <StaleNotice reason={staleReason} onRerun={onRerun} />}
      <Stack gap="md" style={stale ? { opacity: 0.55 } : undefined}>
        <div data-testid="result-verdict">
          <WallVerdict result={result} onEditGeometry={onEditGeometry} />
        </div>

        {result.warnings.length > 0 && (
          <div data-testid="result-warnings">
            <VerdictBanner
              tone="warn"
              title={t("walls.result.warnings")}
              text={result.warnings.map((w, i) => (
                <span key={i} style={{ display: "block" }}>{warningText(w)}</span>
              ))}
            />
          </div>
        )}

        <Group align="flex-start" gap="md" wrap="wrap">
          <Box style={{ flex: "999 1 560px", minWidth: 0 }}>
            <SectionCard
              title={t("walls.table.title")}
              aside={
                result.kh !== null && result.kv !== null ? (
                  <StatusChip tone="neutral" dot={false}>
                    kh = {result.kh.toFixed(3)} · kv = {result.kv.toFixed(3)}
                  </StatusChip>
                ) : undefined
              }
            >
              <Box style={{ overflowX: "auto" }}>
                <Box style={{ minWidth: 480 }}>
                  <WallChecksTable result={result} />
                </Box>
              </Box>
              <Text size="xs" c="dimmed" mt="sm">{t("walls.table.legend")}</Text>
              {governingLine && <Text size="xs" c="dimmed" mt={4} data-testid="governing-summary">{governingLine}</Text>}
              {result.checks.some((c) => (c.kv_sign ?? null) !== null) && (
                <Text size="xs" c="dimmed" mt={4} data-testid="kv-envelope-note">
                  {t("walls.result.kv_envelope_note")}
                </Text>
              )}
            </SectionCard>
          </Box>
          <Box style={{ flex: "1 1 380px", minWidth: 0 }}>
            {/* Geometry only: the result carries neither the soil nor the slope the run used. */}
            <WallCrossSection
              wallType={basis.wallType}
              geometry={result.geometry}
              height={basis.height}
              title={t("web.wizard.result_section_title")}
            />
            <Text size="xs" c="dimmed" mt={4}>
              {t("walls.result.section_geometry_only")}
            </Text>
          </Box>
        </Group>

        <DisclosureList>
          {hasForces && (
            <DisclosureRow title={t("walls.details.forces")} hint={t("walls.details.forces_hint")}>
              <ForcesTable forces={result.forces} />
            </DisclosureRow>
          )}
          {shearKey.length > 0 && (
            <DisclosureRow title={t("walls.key.result_title")}>
              <ShearKeyResult items={shearKey} bare />
            </DisclosureRow>
          )}
          <DisclosureRow title={t("walls.details.factors")} hint={t("walls.details.factors_hint")}>
            <Box style={{ overflowX: "auto" }}>
              <Table withTableBorder withColumnBorders verticalSpacing={3}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("walls.result.factor")}</Table.Th>
                    <Table.Th>{t("ui.col.value")}</Table.Th>
                    <Table.Th>{t("ui.col.status")}</Table.Th>
                    <Table.Th>{t("ui.col.source")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.factors_used.map((f) => (
                    <Table.Tr key={f.path}>
                      <Table.Td fz="xs" title={f.path}>
                        {factorPathLabel(f.path, t)}
                      </Table.Td>
                      <Table.Td ff="monospace" fw={600}>
                        {f.value ?? t("web.common.none")}
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light" style={{ overflow: "visible" }}>
                          {t(`fstatus.${f.status}`)}
                        </Badge>
                      </Table.Td>
                      <Table.Td fz="xs">{f.source}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </DisclosureRow>
          <DisclosureRow
            title={t("walls.details.assumptions")}
            aside={result.assumptions.length > 0 ? <StatusChip tone="stale" dot={false}>{result.assumptions.length}</StatusChip> : undefined}
          >
            <Box style={{ overflowX: "auto" }}>
              <Table withTableBorder withColumnBorders verticalSpacing={3}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("ui.col.assumption")}</Table.Th>
                    <Table.Th>{t("ui.col.source")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.assumptions.map((a, idx) => (
                    <Table.Tr key={`assumption-${idx}`}>
                      <Table.Td fz="xs">{assumptionText(a)}</Table.Td>
                      <Table.Td fz="xs">{a.source}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </DisclosureRow>
        </DisclosureList>
      </Stack>
    </Stack>
  );
}
