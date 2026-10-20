import { useEffect, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { Badge, Button, Card, Group, NativeSelect, NumberInput, SegmentedControl, Stack, Table, Text, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { DerivedParameter, ParameterSelection } from "../../../shared/api/types";
import {
  approvalState,
  buildUpdate,
  draftFromSelection,
  formatValue,
  isDirty,
  readiness,
  STATISTICS,
  type PickMode,
  type SelectionDraft,
  validCandidates,
} from "../parameterState";
import { displayUnit } from "../units";
import { WarningList } from "./WarningList";

const STATE_COLOR = { approved: "green", stale: "orange", unapproved: "gray" } as const;

interface Props {
  selection: ParameterSelection;
  busy: boolean;
  /** Persist the draft (PUT); resolves when the parent has reloaded the list. */
  onApply: (update: NonNullable<ReturnType<typeof buildUpdate>>) => Promise<void>;
  onApprove: () => Promise<void>;
  /** Reports whether the card holds an unapplied draft, so bulk actions can exclude it. */
  onDirtyChange?: (key: ParameterSelection["parameter"], dirty: boolean) => void;
}

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(locale);
}

function CandidateRows({ rows, selection }: { rows: { key: string; candidate: DerivedParameter; suggested: boolean }[]; selection: ParameterSelection }) {
  const { t } = useTranslation();
  const narrow = useMediaQuery("(max-width: 900px)") ?? false;
  return (
    <Table.ScrollContainer minWidth={narrow ? 0 : 620} type="native">
      <Table withTableBorder withColumnBorders fz="xs" verticalSpacing={3} data-testid={`param-candidates-${selection.parameter}`}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("soil.params.col.method")}</Table.Th>
            <Table.Th>{t("soil.params.col.value")}</Table.Th>
            <Table.Th>{t("soil.params.col.stats")}</Table.Th>
            <Table.Th>{t("soil.params.col.reliability")}</Table.Th>
            <Table.Th>{t("soil.params.col.source")}</Table.Th>
            {!narrow && <Table.Th>{t("soil.params.col.reference")}</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ key, candidate: c, suggested }) => (
            <Table.Tr key={key} opacity={c.validity_ok === false ? 0.65 : 1}>
              <Table.Td>
                <Tooltip label={c.reference || c.method_id} withArrow multiline w={280} disabled={!c.reference}>
                  <Text size="xs" ff="monospace" style={{ whiteSpace: "nowrap" }}>
                    {c.method_id}
                  </Text>
                </Tooltip>
                {narrow && c.reference && (
                  <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                    {c.reference}
                  </Text>
                )}
                {suggested && (
                  <Badge size="xs" variant="light" color="blue">
                    {t("soil.params.suggested_row")}
                  </Badge>
                )}
                {c.validity_ok === false && (
                  <Badge size="xs" variant="light" color="orange" ml={4} styles={{ root: { height: "auto", paddingBlock: 2 }, label: { whiteSpace: "normal" } }}>
                    {t("soil.params.invalid_candidate")}
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="xs" fw={600}>
                  {formatValue(c.value)} {displayUnit(c.unit)}
                </Text>
              </Table.Td>
              <Table.Td>
                {c.stats ? `${c.stats.n} / ${formatValue(c.stats.min)} / ${formatValue(c.stats.mean)} / ${formatValue(c.stats.max)}` : t("web.common.none")}
              </Table.Td>
              <Table.Td>{c.reliability ?? t("web.common.none")}</Table.Td>
              <Table.Td>{t(`soil.params.source.${c.source}`)}</Table.Td>
              <Table.Td style={{ minWidth: 180 }}>
                {!narrow && (
                  <Text size="xs" style={{ overflowWrap: "anywhere" }}>
                    {c.reference ?? t("web.common.none")}
                  </Text>
                )}
                <div style={{ maxHeight: 160, overflowY: "auto" }}>
                  <WarningList warnings={c.warnings ?? []} />
                </div>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function ParameterKeyCard({ selection, busy, onApply, onApprove, onDirtyChange }: Props) {
  const { t, i18n } = useTranslation();
  const key = selection.parameter;
  const [draft, setDraft] = useState<SelectionDraft>(() => draftFromSelection(selection));

  // New server content (after apply/approve/suggest-all) resets the draft to what is stored; an unrelated
  // reload that leaves this selection unchanged keeps the engineer's unapplied edits.
  const stamp = JSON.stringify(selection);
  useEffect(() => {
    setDraft(draftFromSelection(selection));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  const state = approvalState(selection);
  const unit = displayUnit(selection.selected?.unit ?? selection.suggested?.unit ?? selection.candidates?.[0]?.unit ?? "");
  const hasSuggestion = Boolean(selection.suggested);
  const candidates = selection.candidates ?? [];
  const statisticPossible = validCandidates(selection).length > 0;
  const update = buildUpdate(draft, selection);
  const dirty = isDirty(draft, selection);
  const ready = readiness(selection);
  // A stale approval or candidates that moved on since the choice was applied: the server re-resolves on
  // approve, so the engineer must re-apply (PUT) and see the value that will actually be approved.
  const needsReapply = ready === "stale" || ready === "outdated";

  useEffect(() => {
    onDirtyChange?.(key, dirty);
  }, [key, dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(key, false), [key, onDirtyChange]);

  const suggestedIsCandidate = candidates.some((c) => c.method_id === selection.suggested?.method_id);
  const rows = [
    ...(selection.suggested && !suggestedIsCandidate ? [{ key: "suggested", candidate: selection.suggested, suggested: true }] : []),
    ...candidates.map((c) => ({ key: c.method_id, candidate: c, suggested: c.method_id === selection.suggested?.method_id })),
  ];

  const pickData: { value: PickMode; label: string; disabled: boolean }[] = [
    { value: "suggested", label: t("soil.params.mode.suggested"), disabled: !hasSuggestion },
    { value: "method", label: t("soil.params.mode.method"), disabled: candidates.length === 0 },
    { value: "statistic", label: t("soil.params.mode.statistic"), disabled: !statisticPossible },
    { value: "manual", label: t("soil.params.mode.manual"), disabled: false },
  ];

  const canApprove = ready === "ready" && !dirty;

  return (
    <Card withBorder padding="sm" radius="sm" data-testid={`param-card-${key}`}>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <div style={{ minWidth: 0 }}>
            <Text fw={600} size="sm">
              {t(`soil.params.key.${key}`)}
            </Text>
            <Text size="xs" c="dimmed">
              {unit ? `[${unit}]` : ""}
            </Text>
          </div>
          <Badge color={STATE_COLOR[state]} variant={state === "approved" ? "filled" : "light"} data-testid={`param-state-${key}`}>
            {state === "approved" ? t("soil.params.approved") : state === "stale" ? t("soil.params.stale") : t("soil.params.not_approved")}
          </Badge>
        </Group>

        {state === "stale" && (
          <Text size="xs" c="orange.8" data-testid={`param-stale-${key}`}>
            {t("soil.params.stale_hint", {
              date: formatDate(selection.approved_at, i18n.language),
              value: selection.selected ? `${formatValue(selection.selected.value)} ${displayUnit(selection.selected.unit)}` : "-",
            })}
          </Text>
        )}
        {state === "approved" && (
          <Text size="xs" c="dimmed">
            {t("soil.params.approved_hint", { date: formatDate(selection.approved_at, i18n.language) })}
          </Text>
        )}

        <Group gap={6} align="baseline" wrap="wrap">
          <Text size="xs" c="dimmed">
            {t("soil.params.selected")}:
          </Text>
          {selection.selected ? (
            <>
              <Text size="sm" fw={700} data-testid={`param-selected-${key}`}>
                {formatValue(selection.selected.value)} {displayUnit(selection.selected.unit)}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace" style={{ overflowWrap: "anywhere" }}>
                {selection.selected.method_id}
              </Text>
            </>
          ) : (
            <Text size="xs" c="dimmed">
              {t("soil.params.nothing_selected")}
            </Text>
          )}
        </Group>

        <Text size="xs" fw={600}>
          {t("soil.params.candidates")}
        </Text>
        {rows.length > 0 ? (
          <CandidateRows rows={rows} selection={selection} />
        ) : (
          <Text size="xs" c="dimmed">
            {t("soil.params.no_candidates")}
          </Text>
        )}
        {!hasSuggestion && (
          <Text size="xs" c="dimmed">
            {t("soil.params.no_suggestion")}
          </Text>
        )}

        <Stack gap={6}>
          <Text size="xs" fw={600}>
            {t("soil.params.mode")}
          </Text>
          <SegmentedControl
            size="xs"
            fullWidth
            data={pickData}
            value={draft.pick ?? ""}
            onChange={(value) => setDraft((d) => ({ ...d, pick: value as PickMode }))}
            aria-label={t("soil.params.mode")}
            data-testid={`param-mode-${key}`}
            styles={{ root: { flexWrap: "wrap" } }}
          />
          {draft.pick === "method" && (
            <NativeSelect
              size="xs"
              label={t("soil.params.method")}
              data={candidates.map((c) => ({ value: c.method_id, label: `${c.method_id}: ${formatValue(c.value)} ${displayUnit(c.unit)}` }))}
              value={draft.method_id}
              onChange={(e) => setDraft((d) => ({ ...d, method_id: e.currentTarget.value }))}
              data-testid={`param-method-${key}`}
            />
          )}
          {draft.pick === "statistic" && (
            <Group align="flex-end" gap="xs" wrap="wrap">
              <NativeSelect
                size="xs"
                label={t("soil.params.statistic")}
                data={STATISTICS.map((s) => ({ value: s, label: t(`soil.params.statistic.${s}`) }))}
                value={draft.statistic}
                onChange={(e) => setDraft((d) => ({ ...d, statistic: e.currentTarget.value as SelectionDraft["statistic"] }))}
                data-testid={`param-statistic-${key}`}
              />
              {draft.statistic === "mean_minus_k_sd" && (
                <NumberInput
                  size="xs"
                  w={140}
                  min={0}
                  decimalScale={3}
                  hideControls
                  label={t("soil.params.k_sd")}
                  description={t("soil.params.k_sd_hint")}
                  value={draft.k_sd}
                  onChange={(v) => setDraft((d) => ({ ...d, k_sd: typeof v === "number" ? v : "" }))}
                  data-testid={`param-ksd-${key}`}
                />
              )}
            </Group>
          )}
          {draft.pick === "manual" && (
            <NumberInput
              size="xs"
              w={180}
              hideControls
              decimalScale={4}
              label={t("soil.params.manual_value", { unit: unit || "-" })}
              value={draft.manual_value}
              onChange={(v) => setDraft((d) => ({ ...d, manual_value: typeof v === "number" ? v : "" }))}
              data-testid={`param-manual-${key}`}
            />
          )}
          {draft.pick === null && (
            <Text size="xs" c="dimmed">
              {t("soil.params.pick_needed")}
            </Text>
          )}
        </Stack>

        <Group gap="xs" wrap="wrap">
          <Button
            size="xs"
            variant="default"
            disabled={busy || update === null || (!dirty && !needsReapply)}
            onClick={() => update && void onApply(update)}
            data-testid={`param-apply-${key}`}
          >
            {t("soil.params.apply")}
          </Button>
          <Button size="xs" disabled={busy || !canApprove} onClick={() => void onApprove()} data-testid={`param-approve-${key}`}>
            {t("soil.params.approve")}
          </Button>
          {dirty ? (
            <Text size="xs" c="orange.8">
              {t("soil.params.unapplied")}
            </Text>
          ) : needsReapply ? (
            <Text size="xs" c="orange.8" data-testid={`param-reapply-${key}`}>
              {ready === "stale" ? t("soil.params.reapply_needed") : t("soil.params.outdated_hint")}
            </Text>
          ) : (
            state === "approved" && (
              <Text size="xs" c="dimmed">
                {t("soil.params.revoked_hint")}
              </Text>
            )
          )}
        </Group>
      </Stack>
    </Card>
  );
}
