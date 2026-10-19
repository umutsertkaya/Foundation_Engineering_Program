import { Alert, Badge, Card, Group, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { CheckDTO, WallResultDTO } from "../../../shared/api/types";
import { utilisationColor } from "../../../shared/utils/utilisation";
import {
  checkKey,
  checkKeyLabel,
  checkNameLabel,
  comboLabel,
  deriveGoverning,
  parseKvSign,
  splitCase,
  stateLabel,
  utilisationPercent,
  type GoverningInfo,
} from "../labels";

export type RunMode = "suggest" | "check";

/** FS / ratio display: three decimals below 1 (e/B), two otherwise; non-finite = unlimited. */
export function formatQuantity(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "∞";
  return Math.abs(value) < 1 ? value.toFixed(3) : value.toFixed(2);
}

export interface WallCheckCardProps {
  check: CheckDTO;
  governing: boolean;
  governingKind: GoverningInfo["kind"];
}

export function WallCheckCard({ check, governing, governingKind }: WallCheckCardProps) {
  const { t } = useTranslation();
  const { state, combo } = splitCase(check.case);
  const kv = parseKvSign(check.detail);
  const percent = utilisationPercent(check);
  const color = utilisationColor(check.utilisation);
  const symbol = check.comparison === ">=" ? "≥" : "≤";
  const bar = percent === null ? 0 : Math.min(100, Math.max(0, percent));

  return (
    <Card
      withBorder
      padding="xs"
      radius="sm"
      data-testid="check-card"
      data-check-key={checkKey(check)}
      data-governing={governing || undefined}
      data-passed={check.passed}
      style={governing ? { borderColor: "var(--mantine-color-blue-filled)", borderWidth: 2 } : undefined}
    >
      <Stack gap={6}>
        <Group justify="space-between" gap={4} wrap="nowrap" align="flex-start">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text size="sm" fw={600} style={{ overflowWrap: "anywhere" }}>
              {checkNameLabel(check.name, t)}
            </Text>
            <Group gap={4} wrap="wrap">
              <Badge size="xs" variant="light" color={state === "seismic" ? "orange" : "blue"} style={{ overflow: "visible" }}>
                {stateLabel(state, t)}
              </Badge>
              {combo !== null && (
                <Text size="xs" c="dimmed">
                  {comboLabel(combo, t)}
                </Text>
              )}
              {kv.direction !== null && (
                <Badge size="xs" variant="outline" color="grape" style={{ overflow: "visible" }} data-kv-sign={kv.direction} title={t("walls.result.kv_governing_hint")}>
                  {t(`walls.result.kv_${kv.direction}`)}
                </Badge>
              )}
            </Group>
          </Stack>
          <Badge size="xs" color={check.passed ? "green" : "red"} variant="light" style={{ flexShrink: 0, overflow: "visible" }}>
            {check.passed ? t("ui.ok") : t("ui.not_ok")}
          </Badge>
        </Group>

        <SimpleGrid cols={3} spacing={4}>
          <div>
            <Text size="10px" c="dimmed" tt="uppercase">
              {t("walls.result.computed")}
            </Text>
            <Text size="sm" ff="monospace" fw={700} data-field="value">
              {formatQuantity(check.value)}
            </Text>
          </div>
          <div>
            <Text size="10px" c="dimmed" tt="uppercase">
              {t(check.comparison === ">=" ? "walls.result.required_min" : "walls.result.limit_max")}
            </Text>
            <Text size="sm" ff="monospace" fw={700} data-field="required">
              {symbol} {formatQuantity(check.required)}
            </Text>
          </div>
          <div>
            <Text size="10px" c="dimmed" tt="uppercase">
              {t("web.wizard.utilisation")}
            </Text>
            <Text size="sm" ff="monospace" fw={700} data-field="ratio">
              {percent === null ? "—" : `${percent}%`}
            </Text>
          </div>
        </SimpleGrid>

        <Progress value={bar} color={color} size="sm" radius="xs" aria-label={t("web.wizard.utilisation")} />

        <Group justify="space-between" gap={4} wrap="nowrap" align="flex-start">
          <Text size="xs" c="dimmed" lineClamp={2} title={kv.text} style={{ minWidth: 0 }}>
            {kv.text}
          </Text>
          {governing && governingKind !== null && (
            <Badge size="xs" color="blue" variant="filled" style={{ flexShrink: 0, overflow: "visible" }} data-field="governing-badge">
              {t(`walls.governing.${governingKind}`)}
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

export interface WallCheckCardsProps {
  result: Pick<WallResultDTO, "checks" | "governing" | "passed">;
  mode: RunMode;
  /** Two columns by default; the results page puts the cards next to the section. */
  cols?: number;
  /** Dim the cards: they belong to an earlier run or to inputs that have since changed. */
  stale?: boolean;
}

/** Governing summary line + per-check utilisation cards. */
export function WallCheckCards({ result, mode, cols, stale = false }: WallCheckCardsProps) {
  const { t } = useTranslation();
  const governing = deriveGoverning(result, mode);
  const keys = new Set(governing.keys);
  const seismicEnvelope = result.checks.some((c) => parseKvSign(c.detail).direction !== null);

  return (
    <Stack gap="xs" data-stale={stale || undefined} style={stale ? { opacity: 0.55 } : undefined}>
      {governing.kind !== null && (
        <Alert variant="light" color={result.passed ? "blue" : "red"} p="xs" data-testid="governing-summary">
          <Text size="sm" fw={600}>
            {t(`walls.governing.${governing.kind}_line`, {
              label: governing.keys.map((k) => checkKeyLabel(k, t)).join("; "),
            })}
          </Text>
        </Alert>
      )}
      {seismicEnvelope && (
        <Text size="xs" c="dimmed" data-testid="kv-envelope-note">
          {t("walls.result.kv_envelope_note")}
        </Text>
      )}
      <SimpleGrid cols={cols ?? { base: 1, xs: 2 }} spacing="xs">
        {result.checks.map((check) => (
          <WallCheckCard
            key={checkKey(check)}
            check={check}
            governing={keys.has(checkKey(check))}
            governingKind={governing.kind}
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

