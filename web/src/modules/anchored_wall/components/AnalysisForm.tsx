import { useEffect, useState } from "react";
import {
  ActionIcon, Alert, Badge, Button, Group, Select, SegmentedControl, SimpleGrid, Stack, Switch, Table, Text, Title,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { list_project_profiles } from "../../../shared/api/core";
import type { ProfileSummary } from "../../../shared/api/types";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { get_soil } from "../api";
import { fmt } from "../format";
import { EMPTY_LEVEL, commonMissing, soilGaps, type AnalysisForm } from "../inputs";
import type { AnchorReference } from "../types";
import { AnchorFields } from "./AnchorFields";
import { NumField } from "./NumField";

const MAX_LEVELS = 6;

interface Props {
  value: AnalysisForm;
  onChange: (next: AnalysisForm) => void;
  reference: AnchorReference | null;
  /** The project profile the stored soil was copied from has changed or is gone. */
  soilStale: boolean;
}

export function AnalysisFormView({ value, onChange, reference, soilStale }: Props) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null);
  const [profileId, setProfileId] = useState<string | null>(value.soil?.source_profile_id ?? null);
  const [error, setError] = useState<unknown>(null);
  const set = (patch: Partial<AnalysisForm>) => onChange({ ...value, ...patch });
  const multi = value.levels.length > 1;
  const soldier = value.wall_type === "soldier_pile";

  useEffect(() => {
    let live = true;
    list_project_profiles().then(
      (p) => live && setProfiles(p),
      (e) => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, []);

  const loadSoil = async (id: string | null) => {
    if (!id) return;
    setError(null);
    try {
      set({ soil: await get_soil(id) });
    } catch (e) {
      setError(e);
    }
  };

  const setLevel = (i: number, patch: Partial<AnalysisForm["levels"][number]>) =>
    set({ levels: value.levels.map((lv, j) => (j === i ? { ...lv, ...patch } : lv)) });
  const gaps = soilGaps(value.soil, value.drainage, value.excavation_height);

  return (
    <Stack gap="md">
      <Title order={5}>{t("anchored_wall.section.wall")}</Title>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Select
          label={t("anchored_wall.input.wall_type")}
          data={[
            { value: "sheet_pile", label: t("anchored_wall.wall_type.sheet_pile") },
            { value: "soldier_pile", label: t("anchored_wall.wall_type.soldier_pile") },
          ]}
          value={value.wall_type}
          allowDeselect={false}
          onChange={(v) => set({ wall_type: (v as AnalysisForm["wall_type"]) ?? "sheet_pile" })}
        />
        <NumField label={t("anchored_wall.input.excavation_height")} value={value.excavation_height} onChange={(v) => set({ excavation_height: v })} min={0} decimalScale={2} />
        <Select
          label={t("anchored_wall.input.drainage")}
          data={[
            { value: "drained", label: t("anchored_wall.drainage.drained") },
            { value: "undrained", label: t("anchored_wall.drainage.undrained") },
          ]}
          value={value.drainage}
          allowDeselect={false}
          onChange={(v) => set({ drainage: (v as AnalysisForm["drainage"]) ?? "drained" })}
        />
        <NumField
          label={t("anchored_wall.input.backfill_slope")}
          description={multi ? t("anchored_wall.input.backfill_slope_single_only") : undefined}
          value={value.backfill_slope}
          onChange={(v) => set({ backfill_slope: v })}
          disabled={multi}
          min={0}
          max={45}
          decimalScale={1}
        />
        <NumField label={t("anchored_wall.input.surcharge")} value={value.surcharge} onChange={(v) => set({ surcharge: v })} min={0} decimalScale={1} />
        <Select
          label={t("anchored_wall.input.surcharge_basis")}
          data={[
            { value: "horizontal", label: t("anchored_wall.input.surcharge_basis_horizontal") },
            { value: "inclined", label: t("anchored_wall.input.surcharge_basis_inclined") },
          ]}
          value={value.surcharge_basis}
          allowDeselect={false}
          onChange={(v) => set({ surcharge_basis: (v as AnalysisForm["surcharge_basis"]) ?? "horizontal" })}
        />
        <NumField label={t("anchored_wall.input.passive_factor")} description={t("anchored_wall.input.passive_factor_hint")} value={value.passive_factor} onChange={(v) => set({ passive_factor: v })} min={1} decimalScale={2} />
        <NumField label={t("anchored_wall.input.depth_increase")} description={t("anchored_wall.input.depth_increase_hint")} value={value.depth_increase} onChange={(v) => set({ depth_increase: v })} min={0} decimalScale={2} />
        {multi && (
          <Select
            label={t("anchored_wall.input.load_method")}
            data={[
              { value: "hinge", label: t("anchored_wall.load_method.hinge") },
              { value: "tributary", label: t("anchored_wall.load_method.tributary") },
            ]}
            value={value.load_method}
            allowDeselect={false}
            onChange={(v) => set({ load_method: (v as AnalysisForm["load_method"]) ?? "hinge" })}
          />
        )}
        {multi && value.drainage === "undrained" && (
          <NumField label={t("anchored_wall.input.stiff_clay_coefficient")} value={value.stiff_clay_coefficient} onChange={(v) => set({ stiff_clay_coefficient: v })} min={0.2} max={0.4} decimalScale={2} />
        )}
      </SimpleGrid>
      {soldier && (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <NumField label={t("anchored_wall.input.pile_spacing")} value={value.pile_spacing} onChange={(v) => set({ pile_spacing: v })} min={0} decimalScale={2} />
          <NumField label={t("anchored_wall.input.passive_width")} value={value.passive_width} onChange={(v) => set({ passive_width: v })} min={0} decimalScale={2} />
        </SimpleGrid>
      )}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <NumField label={t(soldier ? "anchored_wall.input.w_cm3_pile" : "anchored_wall.input.w_cm3_m")} value={value.w_cm3} onChange={(v) => set({ w_cm3: v })} min={0} decimalScale={1} />
        <NumField label={t("anchored_wall.input.allowable_stress")} value={value.allowable_stress_mpa} onChange={(v) => set({ allowable_stress_mpa: v })} min={0} decimalScale={1} />
        <NumField label={t("anchored_wall.input.ei")} description={t("anchored_wall.input.ei_hint")} value={value.ei_knm2} onChange={(v) => set({ ei_knm2: v })} min={0} decimalScale={0} />
      </SimpleGrid>

      <Title order={5}>{t("anchored_wall.section.levels")}</Title>
      <Table withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>{t("anchored_wall.report.level_depth")}</Table.Th>
            <Table.Th>{t("anchored_wall.report.level_spacing")}</Table.Th>
            <Table.Th>{t("anchored_wall.report.level_inclination")}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {value.levels.map((lv, i) => (
            <Table.Tr key={i}>
              <Table.Td>{i + 1}</Table.Td>
              <Table.Td><NumField aria-label={`${t("anchored_wall.report.level_depth")} ${i + 1}`} value={lv.depth} onChange={(v) => setLevel(i, { depth: v })} min={0} decimalScale={2} /></Table.Td>
              <Table.Td><NumField aria-label={`${t("anchored_wall.report.level_spacing")} ${i + 1}`} value={lv.spacing} onChange={(v) => setLevel(i, { spacing: v })} min={0} decimalScale={2} /></Table.Td>
              <Table.Td><NumField aria-label={`${t("anchored_wall.report.level_inclination")} ${i + 1}`} value={lv.inclination_deg} onChange={(v) => setLevel(i, { inclination_deg: v })} min={0} max={59} decimalScale={1} /></Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="red" aria-label={t("anchored_wall.action.remove_level")} disabled={value.levels.length === 1} onClick={() => set({ levels: value.levels.filter((_, j) => j !== i) })}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group>
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} disabled={value.levels.length >= MAX_LEVELS} onClick={() => set({ levels: [...value.levels, { ...EMPTY_LEVEL }] })}>
          {t("anchored_wall.action.add_level")}
        </Button>
      </Group>

      <Title order={5}>{t("anchored_wall.section.soil")}</Title>
      {error != null && <ErrorAlert error={error} />}
      <Group align="flex-end">
        <Select
          label={t("anchored_wall.input.profile")}
          placeholder={t("anchored_wall.input.profile_placeholder")}
          data={(profiles ?? []).map((p) => ({ value: p.id, label: `${p.name} (${p.layer_count})` }))}
          value={profileId}
          onChange={setProfileId}
          nothingFoundMessage={t("anchored_wall.input.no_profiles")}
          style={{ minWidth: 260 }}
        />
        <Button variant="light" disabled={!profileId} onClick={() => void loadSoil(profileId)}>
          {t("anchored_wall.action.load_soil")}
        </Button>
      </Group>
      {soilStale && value.soil?.source_profile_id && (
        <Alert color="blue" variant="light" title={t("anchored_wall.soil.stale_title")}>
          <Group justify="space-between">
            <Text size="sm">{t("anchored_wall.soil.stale")}</Text>
            <Button size="xs" variant="light" onClick={() => void loadSoil(value.soil?.source_profile_id ?? null)}>
              {t("anchored_wall.action.resync")}
            </Button>
          </Group>
        </Alert>
      )}
      {value.soil && (
        <Table withTableBorder data-testid="aw-soil">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("report.soil.top")}</Table.Th>
              <Table.Th>{t("report.soil.bottom")}</Table.Th>
              <Table.Th>{t("report.soil.gamma")}</Table.Th>
              <Table.Th>{t("report.soil.phi")}</Table.Th>
              <Table.Th>{t("report.soil.c")}</Table.Th>
              <Table.Th>{t("report.soil.su")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {value.soil.profile.layers.map((l) => {
              const gap = gaps.includes(l.id);
              return (
                <Table.Tr key={l.id}>
                  <Table.Td>{fmt(l.top)}</Table.Td>
                  <Table.Td>{fmt(l.bottom)}</Table.Td>
                  <Table.Td>{fmt(l.gamma, 1)}</Table.Td>
                  <Table.Td>{fmt(l.design?.phi_eff, 1)}</Table.Td>
                  <Table.Td>{fmt(l.design?.c_eff, 1)}</Table.Td>
                  <Table.Td>
                    {fmt(l.design?.su, 1)}
                    {gap && <Badge ml="xs" color="red" variant="light">{t("anchored_wall.soil.missing_value")}</Badge>}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
      <Text size="xs" c="dimmed">{t("anchored_wall.soil.copy_note")}</Text>

      <Switch
        label={t("anchored_wall.input.design_anchors")}
        description={t("anchored_wall.input.design_anchors_hint")}
        checked={value.design_anchors}
        onChange={(e) => set({ design_anchors: e.currentTarget.checked })}
      />
      {value.design_anchors && (
        <AnchorFields
          value={value.common}
          onChange={(common) => set({ common })}
          reference={reference}
          missing={commonMissing(value.common)}
        />
      )}
    </Stack>
  );
}
