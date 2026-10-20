import { useEffect, useState } from "react";
import { ActionIcon, Button, Group, NumberInput, Select, SegmentedControl, Stack, Table, Text } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { list_project_profiles } from "../../../shared/api/core";
import type { ProfileSummary } from "../../../shared/api/types";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { EMPTY_LAYER, type ManualLayer, type Num, type SoilSource } from "../inputs";

interface Props {
  value: SoilSource;
  onChange: (next: SoilSource) => void;
  missing: string[];
}

const toNum = (v: number | string): Num => (typeof v === "number" ? v : "");

function lastBottom(layers: ManualLayer[]): Num {
  const last = layers[layers.length - 1];
  return last && typeof last.bottom === "number" ? last.bottom : "";
}

export function SoilSourceForm({ value, onChange, missing }: Props) {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    list_project_profiles()
      .then((p) => {
        if (live) setProfiles(p);
      })
      .catch((e) => {
        if (live) setError(e);
      });
    return () => {
      live = false;
    };
  }, []);

  const set = (patch: Partial<SoilSource>) => onChange({ ...value, ...patch });
  const setLayer = (i: number, patch: Partial<ManualLayer>) =>
    set({ layers: value.layers.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const req = (key: string) => (missing.includes(key) ? t("sheet_pile.inputs.required") : undefined);

  return (
    <Stack gap="sm">
      <SegmentedControl
        value={value.mode}
        onChange={(v) => set({ mode: v as SoilSource["mode"] })}
        data={[
          { value: "profile", label: t("sheet_pile.soil.from_profile") },
          { value: "manual", label: t("sheet_pile.soil.manual") },
        ]}
      />
      {error != null && <ErrorAlert error={error} />}

      {value.mode === "profile" && (
        <Stack gap="xs">
          <Select
            label={t("sheet_pile.soil.profile")}
            placeholder={t("sheet_pile.soil.profile_placeholder")}
            data={(profiles ?? []).map((p) => ({ value: p.id, label: `${p.name} (${p.layer_count})` }))}
            value={value.profile_id}
            error={req("profile")}
            onChange={(v) => set({ profile_id: v })}
            nothingFoundMessage={t("sheet_pile.soil.no_profiles")}
          />
          {profiles != null && profiles.length === 0 && (
            <Text size="sm" c="dimmed">
              {t("sheet_pile.soil.no_profiles_hint")}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {t("sheet_pile.soil.copy_note")}
          </Text>
        </Stack>
      )}

      {value.mode === "manual" && (
        <Stack gap="xs">
          <NumberInput
            label={t("sheet_pile.soil.gwt")}
            value={value.gwt}
            error={req("gwt")}
            min={0}
            decimalScale={2}
            onChange={(v) => set({ gwt: toNum(v) })}
          />
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("sheet_pile.soil.top")}</Table.Th>
                <Table.Th>{t("sheet_pile.soil.bottom")}</Table.Th>
                <Table.Th>{t("sheet_pile.soil.gamma")}</Table.Th>
                <Table.Th>{t("sheet_pile.soil.phi")}</Table.Th>
                <Table.Th>{t("sheet_pile.soil.c")}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {value.layers.map((l, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <NumberInput
                      aria-label={`${t("sheet_pile.soil.top")} ${i + 1}`}
                      value={l.top}
                      error={missing.includes(`layer_${i}_geometry`) ? t("sheet_pile.inputs.required") : missing.includes(`range:layer_${i}_geometry`) ? t("sheet_pile.missing.range_layer_geometry", { n: i + 1 }) : undefined}
                      min={0}
                      decimalScale={2}
                      onChange={(v) => setLayer(i, { top: toNum(v) })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      aria-label={`${t("sheet_pile.soil.bottom")} ${i + 1}`}
                      value={l.bottom}
                      error={missing.includes(`layer_${i}_geometry`) ? t("sheet_pile.inputs.required") : missing.includes(`range:layer_${i}_geometry`) ? t("sheet_pile.missing.range_layer_geometry", { n: i + 1 }) : undefined}
                      min={0}
                      decimalScale={2}
                      onChange={(v) => setLayer(i, { bottom: toNum(v) })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      aria-label={`${t("sheet_pile.soil.gamma")} ${i + 1}`}
                      value={l.gamma}
                      error={missing.includes(`layer_${i}_geometry`) ? t("sheet_pile.inputs.required") : missing.includes(`range:layer_${i}_gamma`) ? t("sheet_pile.missing.range_layer_gamma", { n: i + 1 }) : undefined}
                      min={0}
                      decimalScale={1}
                      onChange={(v) => setLayer(i, { gamma: toNum(v) })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      aria-label={`${t("sheet_pile.soil.phi")} ${i + 1}`}
                      value={l.phi}
                      error={missing.includes(`layer_${i}_phi`) ? t("sheet_pile.inputs.required") : undefined}
                      min={0}
                      max={60}
                      decimalScale={1}
                      onChange={(v) => setLayer(i, { phi: toNum(v) })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      aria-label={`${t("sheet_pile.soil.c")} ${i + 1}`}
                      value={l.c}
                      min={0}
                      decimalScale={1}
                      onChange={(v) => setLayer(i, { c: toNum(v) })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={t("sheet_pile.soil.remove_layer")}
                      onClick={() => set({ layers: value.layers.filter((_, j) => j !== i) })}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {missing.includes("layers") && (
            <Text size="xs" c="red">
              {t("sheet_pile.soil.layers_required")}
            </Text>
          )}
          <Group>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => set({ layers: [...value.layers, { ...EMPTY_LAYER, top: lastBottom(value.layers) }] })}
            >
              {t("sheet_pile.soil.add_layer")}
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
