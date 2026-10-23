import { useState } from "react";
import { Alert, Badge, Button, FileInput, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Table, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { analyze_workbook, check_workbook, commit_workbook } from "../api";
import type { ImportIssue, ImportOptions, ImportPlan, SheetPlan, SheetRole, WorkbookImportResult } from "../types";
import { WarningList } from "./WarningList";

const ROLE_FIELDS: Record<SheetRole, { required: string[]; optional: string[] }> = {
  cpt: { required: ["depth", "qc"], optional: ["fs", "u2", "point_id"] },
  spt: {
    required: [],
    optional: ["depth", "drive_start", "drive_end", "n", "blow1", "blow2", "blow3", "rod_length",
      "energy_ratio", "borehole_diameter", "sampler", "description", "point_id"],
  },
  samples: { required: ["sample_id", "depth"], optional: ["gamma", "w", "Gs", "sieve_mass", "specimen", "point_id"] },
  sieve: { required: ["sample_id", "opening", "retained"], optional: ["pan"] },
  limits: { required: ["sample_id", "test", "w"], optional: ["replicate", "blows"] },
  cu_setup: { required: ["test_id", "consolidation", "cell"], optional: ["sample_id", "back_pressure", "b_value"] },
  cu_curves: { required: ["test_id", "strain", "q", "u"], optional: [] },
};
const ROLES = Object.keys(ROLE_FIELDS) as SheetRole[];
const STRESS = ["qc", "fs", "u2", "consolidation", "cell", "back_pressure", "q", "u"];
const LENGTH = ["depth", "drive_start", "drive_end", "rod_length"];
const MM = ["borehole_diameter", "opening"];
const STRESS_UNITS = ["kPa", "MPa", "kgf/cm2", "bar", "tsf", "psf", "psi"];
const LENGTH_UNITS = ["m", "cm", "mm", "ft", "in"];
const MM_UNITS = ["mm", "cm", "m", "in", "ft"];
const GAMMA_UNITS = ["kN/m3", "tf/m3", "pcf"];

function unitChoices(field: string): string[] | null {
  if (STRESS.includes(field)) return STRESS_UNITS;
  if (LENGTH.includes(field)) return LENGTH_UNITS;
  if (MM.includes(field)) return MM_UNITS;
  if (field === "gamma") return GAMMA_UNITS;
  return null;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onImported: (result: WorkbookImportResult) => void;
}

export function WorkbookImportModal({ opened, onClose, onImported }: Props) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<WorkbookImportResult | null>(null);

  const reset = () => {
    setFile(null); setPlan(null); setDirty(false); setError(null); setResult(null);
  };
  const close = () => { reset(); onClose(); };

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const analyse = (f: File | null) => {
    setFile(f);
    setPlan(null);
    setResult(null);
    if (f) void run(async () => { setPlan(await analyze_workbook(f)); setDirty(false); });
  };
  const edit = (next: ImportPlan) => { setPlan(next); setDirty(true); };
  const check = () => file && plan && void run(async () => { setPlan(await check_workbook(file, plan)); setDirty(false); });
  const commit = () => file && plan && void run(async () => {
    const done = await commit_workbook(file, plan);
    setResult(done);
    onImported(done);
  });

  const setSheet = (index: number, patch: Partial<SheetPlan>) => {
    if (!plan) return;
    edit({ ...plan, sheets: (plan.sheets ?? []).map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  };
  const setOptions = (patch: Partial<ImportOptions>) => {
    if (!plan) return;
    edit({ ...plan, options: { ...(plan.options as ImportOptions), ...patch } });
  };

  const issues = plan?.issues ?? [];
  const blockers = issues.filter((i) => i.severity === "blocker");
  const options = plan?.options as ImportOptions | undefined;
  const roles = new Set((plan?.sheets ?? []).map((s) => s.role).filter(Boolean));
  const issueText = (i: ImportIssue) => {
    const replace = Object.fromEntries(
      Object.entries(i.params ?? {}).map(([k, v]) => [k, v === null ? "" : v]),
    ) as Record<string, string | number>;
    const text = t(i.code, { replace });
    return i.sheet ? `${i.sheet}: ${text}` : text;
  };

  return (
    <Modal opened={opened} onClose={close} title={t("web.import.title")} size="xl">
      <Stack gap="sm">
        {error != null && <ErrorAlert error={error} />}
        {result ? (
          <Stack gap="xs" data-testid="import-summary">
            <Alert color="green">
              {t("web.import.done", { boreholes: result.boreholes.length, cpts: result.cpts.length })}
            </Alert>
            {result.warnings.length > 0 && (
              <>
                <Text size="sm" fw={600}>{t("web.import.assumptions")}</Text>
                <WarningList warnings={result.warnings} />
              </>
            )}
            <Group justify="flex-end"><Button onClick={close}>{t("web.import.close")}</Button></Group>
          </Stack>
        ) : (
          <>
            <Text size="xs" c="dimmed">{t("web.import.hint")}</Text>
            <FileInput
              label={t("web.import.file")}
              placeholder={t("web.site.import_file_placeholder")}
              accept=".xlsx,.xlsm,.csv"
              value={file}
              onChange={analyse}
            />
            {plan && options && (
              <>
                <Table withTableBorder fz="xs" data-testid="import-sheets">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("web.import.sheet")}</Table.Th>
                      <Table.Th>{t("web.import.role")}</Table.Th>
                      <Table.Th>{t("web.import.rows")}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(plan.sheets ?? []).map((sheet, index) => (
                      <Table.Tr key={sheet.name}>
                        <Table.Td>{sheet.name}</Table.Td>
                        <Table.Td>
                          <Select
                            size="xs"
                            aria-label={`${t("web.import.role")} ${sheet.name}`}
                            data={ROLES.map((r) => ({ value: r, label: t(`web.import.role.${r}`) }))}
                            placeholder={t("web.import.ignored")}
                            clearable
                            value={sheet.role ?? null}
                            onChange={(v) => setSheet(index, { role: (v as SheetRole | null), columns: {} })}
                          />
                        </Table.Td>
                        <Table.Td>{sheet.row_count}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {(plan.sheets ?? []).map((sheet, index) => sheet.role && (
                  <ColumnEditor key={`${sheet.name}:${sheet.role}`} sheet={sheet} onChange={(columns) => setSheet(index, { columns })} />
                ))}

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  {roles.has("cpt") && (
                    <TextInput label={t("web.site.cpt_id")} value={options.cpt_id ?? ""}
                      onChange={(e) => setOptions({ cpt_id: e.currentTarget.value || null })} />
                  )}
                  <TextInput label={t("web.site.borehole_id")} value={options.borehole_id ?? ""}
                    onChange={(e) => setOptions({ borehole_id: e.currentTarget.value || null })} />
                  <Select label={t("web.import.energy_scale")} clearable
                    data={[{ value: "percent", label: "%" }, { value: "fraction", label: t("web.import.scale_fraction") }]}
                    value={options.energy_ratio_scale ?? null}
                    onChange={(v) => setOptions({ energy_ratio_scale: v as ImportOptions["energy_ratio_scale"] })} />
                  <Select label={t("web.import.water_scale")} clearable
                    data={[{ value: "percent", label: "%" }, { value: "fraction", label: t("web.import.scale_fraction") }]}
                    value={options.water_content_scale ?? null}
                    onChange={(v) => setOptions({ water_content_scale: v as ImportOptions["water_content_scale"] })} />
                  {roles.has("cu_curves") && (
                    <Select label={t("web.import.cu_failure")} allowDeselect={false}
                      data={[
                        { value: "max_stress_ratio", label: t("web.import.cu_ratio") },
                        { value: "max_q", label: t("web.import.cu_q") },
                        { value: "strain_limit", label: t("web.import.cu_strain") },
                      ]}
                      value={options.cu_failure}
                      onChange={(v) => setOptions({ cu_failure: (v ?? "max_stress_ratio") as ImportOptions["cu_failure"] })} />
                  )}
                  {roles.has("cu_curves") && options.cu_failure === "strain_limit" && (
                    <NumberInput label={t("web.import.cu_strain_limit")} min={1} max={40} value={options.cu_strain_limit}
                      onChange={(v) => typeof v === "number" && setOptions({ cu_strain_limit: v })} />
                  )}
                </SimpleGrid>

                {Object.keys(options.sampler_map ?? {}).length > 0 && (
                  <Stack gap={4}>
                    {Object.entries(options.sampler_map ?? {}).map(([text, value]) => (
                      <Select key={text} size="xs" label={t("web.import.sampler_for", { text })}
                        data={[
                          { value: "standard", label: t("web.site.sampler_standard") },
                          { value: "no_liner", label: t("web.site.sampler_no_liner") },
                        ]}
                        value={value ?? null}
                        onChange={(v) => setOptions({ sampler_map: { ...options.sampler_map, [text]: v as "standard" | "no_liner" | null } })} />
                    ))}
                  </Stack>
                )}

                <Stack gap={4} data-testid="import-issues">
                  {issues.map((issue, i) => (
                    <Group key={`${issue.code}-${i}`} gap="xs" wrap="nowrap" align="flex-start">
                      <Badge size="xs" color={issue.severity === "blocker" ? "red" : issue.severity === "confirm" ? "orange" : "gray"}>
                        {t(`web.import.sev.${issue.severity}`)}
                      </Badge>
                      <Text size="xs">{issueText(issue)}</Text>
                    </Group>
                  ))}
                </Stack>
                {dirty && <Text size="xs" c="orange">{t("web.import.dirty")}</Text>}
              </>
            )}
            <Group justify="flex-end" gap="xs">
              <Button variant="default" onClick={close}>{t("start.new.cancel")}</Button>
              {plan && <Button variant="light" loading={busy} onClick={check}>{t("web.import.check")}</Button>}
              {plan && (
                <Button loading={busy} disabled={dirty || blockers.length > 0} onClick={commit}>
                  {t("web.site.import_submit")}
                </Button>
              )}
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

function ColumnEditor({ sheet, onChange }: { sheet: SheetPlan; onChange: (columns: SheetPlan["columns"]) => void }) {
  const { t } = useTranslation();
  const role = sheet.role as SheetRole;
  const { required, optional } = ROLE_FIELDS[role];
  const columns = sheet.columns ?? {};
  const headers = sheet.headers ?? [];
  const setColumn = (field: string, header: string | null) => {
    const next = { ...columns };
    if (header === null) delete next[field];
    else next[field] = { header, unit: null, unit_source: "default" };
    onChange(next);
  };
  const setUnit = (field: string, unit: string | null) => {
    if (unit === null || !columns[field]) return;
    onChange({ ...columns, [field]: { ...columns[field], unit, unit_source: "user" } });
  };
  return (
    <Stack gap={4}>
      <Text size="xs" fw={600}>{sheet.name}: {t("web.import.columns")}</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {[...required, ...optional].map((field) => {
          const mapped = columns[field];
          const units = unitChoices(field);
          return (
            <Group key={field} gap="xs" wrap="nowrap" align="flex-end">
              <Select
                size="xs"
                style={{ flex: 1 }}
                label={`${field}${required.includes(field) ? " *" : ""}`}
                data={headers}
                clearable={!required.includes(field)}
                value={mapped?.header ?? null}
                onChange={(v) => setColumn(field, v)}
              />
              {units && mapped && (
                <Select
                  size="xs"
                  w={96}
                  aria-label={`${field} ${t("web.import.unit")}`}
                  data={units}
                  allowDeselect={false}
                  value={mapped.unit ?? null}
                  onChange={(v) => setUnit(field, v)}
                />
              )}
            </Group>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
