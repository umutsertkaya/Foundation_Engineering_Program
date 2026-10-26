import { Alert, Badge, Button, Checkbox, Group, NumberInput, Radio, Stack, Switch, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { KV_SIGNS, SUBMERGED_MODES, UPLIFT_MODES } from "../settings";
import type { AnalysisOptions } from "../types";

export interface AnalysisOptionsFormProps {
  value: AnalysisOptions;
  onChange: (next: AnalysisOptions) => void;
  level: "basic" | "advanced";
  /** Ids of the submerged retained layers that have no permeability k (relevant for `by_permeability`). */
  missingPermeability: string[];
  /** Whether the engineer has confirmed the current passive reduction value in this session. */
  passiveConfirmed: boolean;
  onConfirmPassive: (confirmed: boolean) => void;
  onGoToSoil?: () => void;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Stack gap={6}>
      <div>
        <Text fw={600} size="sm">
          {title}
        </Text>
        {hint && (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        )}
      </div>
      {children}
    </Stack>
  );
}

/**
 * Seismic and water options of `WallSettings` (kv sign, submerged seismic mode, uplift moment,
 * groundwater bearing correction) and the passive resistance reduction. Controlled; the wizard owns the state.
 */
export function AnalysisOptionsForm({
  value,
  onChange,
  level,
  missingPermeability,
  passiveConfirmed,
  onConfirmPassive,
  onGoToSoil,
}: AnalysisOptionsFormProps) {
  const { t } = useTranslation();
  const set = <K extends keyof AnalysisOptions>(key: K, next: AnalysisOptions[K]) => onChange({ ...value, [key]: next });
  const basic = level === "basic";

  return (
    <div data-testid="analysis-options">
      <Stack gap="md">
        <Section title={t("walls.options.kv.title")} hint={t("walls.options.kv.hint")}>
          <Radio.Group value={value.kv_sign} onChange={(v) => set("kv_sign", v as AnalysisOptions["kv_sign"])} name="kv_sign">
            <Stack gap={6}>
              {KV_SIGNS.map((k) => (
                <Radio key={k} size="xs" value={k} label={t(`walls.options.kv.${k}`)} description={t(`walls.options.kv.${k}.desc`)} />
              ))}
            </Stack>
          </Radio.Group>
        </Section>

        <Section title={t("walls.options.submerged.title")} hint={t("walls.options.submerged.hint")}>
          <Radio.Group
            value={value.submerged_seismic}
            onChange={(v) => set("submerged_seismic", v as AnalysisOptions["submerged_seismic"])}
            name="submerged_seismic"
          >
            <Stack gap={6}>
              {SUBMERGED_MODES.map((m) => (
                <Radio key={m} size="xs" value={m} label={t(`walls.options.submerged.${m}`)} description={t(`walls.options.submerged.${m}.desc`)} />
              ))}
            </Stack>
          </Radio.Group>
          {value.submerged_seismic === "by_permeability" && (
            <Alert variant="light" color={missingPermeability.length > 0 ? "orange" : "teal"} p="xs" data-testid="permeability-status">
              <Group justify="space-between" gap="xs" wrap="wrap">
                <Text size="xs">
                  {missingPermeability.length > 0
                    ? t("walls.options.submerged.missing_k", { ids: missingPermeability.join(", ") })
                    : t("walls.options.submerged.all_k")}
                </Text>
                {onGoToSoil && (
                  <Button size="compact-xs" variant="light" onClick={onGoToSoil}>
                    {t("walls.options.submerged.go_soil")}
                  </Button>
                )}
              </Group>
            </Alert>
          )}
        </Section>

        <Section title={t("walls.options.uplift.title")} hint={t("walls.options.uplift.hint")}>
          <Radio.Group value={value.uplift_moment} onChange={(v) => set("uplift_moment", v as AnalysisOptions["uplift_moment"])} name="uplift_moment">
            <Stack gap={6}>
              {UPLIFT_MODES.map((m) => (
                <Radio key={m} size="xs" value={m} label={t(`walls.options.uplift.${m}`)} description={t(`walls.options.uplift.${m}.desc`)} />
              ))}
            </Stack>
          </Radio.Group>
        </Section>

        <Section title={t("walls.options.gwt_bearing.title")}>
          <Switch
            size="xs"
            checked={value.gwt_bearing_correction}
            onChange={(e) => set("gwt_bearing_correction", e.currentTarget.checked)}
            label={t("walls.options.gwt_bearing.label")}
            description={t("walls.options.gwt_bearing.desc")}
          />
        </Section>

        <Section title={t("walls.options.passive.title")} hint={t("walls.options.passive.hint")}>
          {basic && (
            <Alert variant="light" color="gray" p="xs" data-testid="passive-basic-note">
              <Text size="xs">{t("walls.options.passive.basic_note")}</Text>
            </Alert>
          )}
          <Switch
            size="xs"
            disabled={basic}
            checked={value.use_passive}
            onChange={(e) => set("use_passive", e.currentTarget.checked)}
            label={t("walls.options.passive.use")}
          />
          <NumberInput
            size="xs"
            label={
              <Group gap={6} component="span">
                {t("walls.options.passive.value")}
                <Badge size="xs" variant="light" color="orange" style={{ overflow: "visible" }}>
                  {t("walls.options.passive.engineer_badge")}
                </Badge>
              </Group>
            }
            description={t("walls.options.passive.desc")}
            disabled={basic || !value.use_passive}
            value={value.passive_reduction}
            min={0.01}
            max={1}
            step={0.05}
            decimalScale={2}
            onChange={(v) => {
              if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 1) {
                onChange({ ...value, passive_reduction: v });
                onConfirmPassive(false);
              }
            }}
            data-testid="passive-reduction"
          />
          {!basic && value.use_passive && (
            <Stack gap={4}>
              <Alert variant="light" color={passiveConfirmed ? "green" : "orange"} p="xs" data-testid="passive-confirmation">
                <Text size="xs">
                  {passiveConfirmed
                    ? t("walls.options.passive.confirmed", { value: value.passive_reduction.toFixed(2) })
                    : t("walls.options.passive.unconfirmed", { value: value.passive_reduction.toFixed(2) })}
                </Text>
              </Alert>
              <Checkbox
                size="xs"
                checked={passiveConfirmed}
                onChange={(e) => onConfirmPassive(e.currentTarget.checked)}
                label={t("walls.options.passive.confirm", { value: value.passive_reduction.toFixed(2) })}
              />
              <Text size="xs" c="dimmed">
                {t("walls.options.passive.code_note")}
              </Text>
            </Stack>
          )}
        </Section>
      </Stack>
    </div>
  );
}
