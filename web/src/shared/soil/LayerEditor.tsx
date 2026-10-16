import { useState, type ReactNode } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  List,
  NumberInput,
  Popover,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowMergeAltLeft,
  IconPlus,
  IconRowInsertBottom,
  IconScissors,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { SoilLayer } from "../api/types";
import { CommitNumberInput, CommitTextInput } from "./CommitInputs";
import {
  insertBelow,
  layerErrorKey,
  mergeWithNext,
  removeLayer,
  renameLayer,
  setBoundary,
  splitLayer,
  updateDesign,
  updateLayer,
  type DesignField,
  type LayerIssue,
} from "./layerOps";
import { hasApprovedSelection, layerParamStatus, PARAM_STATUS_COLOR } from "./layerStatus";
import { SoilSwatch, useSoilScheme } from "./SoilPatternDefs";
import { soilFamily, SOIL_FAMILY_LABEL_KEY } from "./soilStyle";
import { USCS_SYMBOLS } from "./uscs";

export interface LayerEditorHistory {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface LayerEditorProps {
  layers: SoilLayer[];
  onChange: (next: SoilLayer[]) => void;
  /** Validation issues for this list (indices refer to `layers`). */
  issues: LayerIssue[];
  selectedId?: string | null;
  onSelect?: (id: string, index: number) => void;
  /** Prefix of generated ids (e.g. "L" for profile layers, "F" for fill). */
  idPrefix?: string;
  /** Ids used elsewhere (e.g. the other list of a structure); new ids avoid them. */
  reservedIds?: string[];
  /** The list may become empty (retained fill). */
  allowEmpty?: boolean;
  history?: LayerEditorHistory;
  /** Last saved layers; approvals of layers whose bounds differ from these are shown as stale. */
  baseLayers?: SoilLayer[];
  toolbarExtra?: ReactNode;
  /** Shown instead of the table when there are no layers. */
  emptyState?: ReactNode;
  ariaLabel?: string;
}

const USCS_OPTIONS = USCS_SYMBOLS.map((s) => ({ value: s, label: s }));

/** Sticky cells need an opaque background; the selected tint is layered over the body colour. */
const OPAQUE_BG = "var(--mantine-color-body)";
const SELECTED_BG =
  "linear-gradient(var(--mantine-color-blue-light), var(--mantine-color-blue-light)), var(--mantine-color-body)";
const STICKY_LEFT = {
  position: "sticky" as const,
  left: 0,
  zIndex: 1,
  boxShadow: "inset -1px 0 0 var(--mantine-color-default-border)",
};
const STICKY_RIGHT = {
  position: "sticky" as const,
  right: 0,
  zIndex: 1,
  minWidth: 180,
  boxShadow: "inset 1px 0 0 var(--mantine-color-default-border)",
};

const DESIGN_COLUMNS: { key: DesignField; labelKey: string; width: number; decimals: number }[] = [
  { key: "phi_eff", labelKey: "ui.layer.phi_eff", width: 54, decimals: 1 },
  { key: "c_eff", labelKey: "ui.layer.c_eff", width: 54, decimals: 1 },
  { key: "su", labelKey: "ui.layer.su", width: 58, decimals: 1 },
  { key: "E", labelKey: "web.soil.col.E", width: 70, decimals: 0 },
  { key: "delta_base", labelKey: "web.soil.col.delta_b", width: 54, decimals: 1 },
];

function SplitAction({
  layer,
  disabled,
  onSplit,
}: {
  layer: SoilLayer;
  disabled: boolean;
  onSplit: (depth: number) => boolean;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const mid = Number.isFinite(layer.top + layer.bottom)
    ? Math.round(((layer.top + layer.bottom) / 2) * 100) / 100
    : 0;
  const [depth, setDepth] = useState<number | string>(mid);
  const [failed, setFailed] = useState(false);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      withArrow
      shadow="md"
      trapFocus
    >
      <Popover.Target>
        <Tooltip label={t("web.soil.action.split")} openDelay={400}>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            disabled={disabled}
            aria-label={`${t("web.soil.action.split")} ${layer.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setDepth(mid);
              setFailed(false);
              setOpened((o) => !o);
            }}
          >
            <IconScissors size={15} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
        <Stack gap={6} w={200}>
          <Text size="xs" fw={600}>
            {t("web.soil.split.title", { id: layer.id })}
          </Text>
          <NumberInput
            size="xs"
            label={t("web.soil.split.depth")}
            description={t("web.soil.split.range", {
              top: layer.top.toFixed(2),
              bottom: layer.bottom.toFixed(2),
            })}
            value={depth}
            onChange={(v) => {
              setDepth(v);
              setFailed(false);
            }}
            decimalScale={3}
            step={0.1}
            hideControls
            error={failed ? t("web.soil.split.invalid") : undefined}
            data-autofocus
          />
          <Group justify="flex-end" gap={6}>
            <Button size="compact-xs" variant="default" onClick={() => setOpened(false)}>
              {t("web.common.cancel")}
            </Button>
            <Button
              size="compact-xs"
              leftSection={<IconScissors size={12} />}
              onClick={() => {
                const d = typeof depth === "number" ? depth : Number.parseFloat(String(depth));
                if (onSplit(d)) setOpened(false);
                else setFailed(true);
              }}
            >
              {t("web.soil.action.split")}
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/** Dense, validated, undoable editor of one contiguous layer list. */
export function LayerEditor({
  layers,
  onChange,
  issues,
  selectedId,
  onSelect,
  idPrefix,
  reservedIds = [],
  allowEmpty = false,
  history,
  baseLayers,
  toolbarExtra,
  emptyState,
  ariaLabel,
}: LayerEditorProps) {
  const { t } = useTranslation();
  const scheme = useSoilScheme();
  const opts = { prefix: idPrefix, reserved: reservedIds };

  const fieldError = (index: number, field: string): string | null => {
    const hit = issues.find((iss) => iss.index === index && iss.field === field);
    return hit ? t(layerErrorKey(hit.code), hit.params ?? {}) : null;
  };

  const errorCount = issues.length;

  const toolbar = (
    <Group justify="space-between" gap="xs" wrap="wrap">
      <Group gap={4} wrap="nowrap">
        {history && (
          <>
            <Tooltip label={t("web.soil.action.undo")} openDelay={400}>
              <ActionIcon
                size="md"
                variant="default"
                disabled={!history.canUndo}
                onClick={history.undo}
                aria-label={t("web.soil.action.undo")}
              >
                <IconArrowBackUp size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("web.soil.action.redo")} openDelay={400}>
              <ActionIcon
                size="md"
                variant="default"
                disabled={!history.canRedo}
                onClick={history.redo}
                aria-label={t("web.soil.action.redo")}
              >
                <IconArrowForwardUp size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
        <Button
          size="compact-sm"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => onChange(insertBelow(layers, layers.length - 1, opts))}
        >
          {t("web.soil.action.add_bottom")}
        </Button>
        {toolbarExtra}
      </Group>
      <Badge
        size="sm"
        variant="light"
        color={errorCount > 0 ? "red" : "green"}
        style={{ flexShrink: 0 }}
      >
        {errorCount > 0 ? t("web.soil.issues_count", { count: errorCount }) : t("web.soil.valid")}
      </Badge>
    </Group>
  );

  if (layers.length === 0) {
    return (
      <Stack gap="xs">
        {history && toolbar}
        {emptyState}
      </Stack>
    );
  }

  return (
    <Stack gap="xs" aria-label={ariaLabel}>
      {toolbar}
      <Table.ScrollContainer minWidth={1180} type="native">
        <Table
          withTableBorder
          withColumnBorders
          verticalSpacing={3}
          horizontalSpacing={4}
          fz="xs"
          stickyHeader
          striped={false}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ ...STICKY_LEFT, background: OPAQUE_BG, zIndex: 3 }}>{t("ui.layer.id")}</Table.Th>
              <Table.Th>{t("ui.layer.top")}</Table.Th>
              <Table.Th>{t("ui.layer.bottom")}</Table.Th>
              <Table.Th>{t("ui.layer.description")}</Table.Th>
              <Table.Th>{t("ui.layer.uscs")}</Table.Th>
              <Table.Th>{t("ui.layer.behaviour")}</Table.Th>
              <Table.Th>{t("web.soil.col.gamma")}</Table.Th>
              <Table.Th>{t("web.soil.col.gamma_sat")}</Table.Th>
              {DESIGN_COLUMNS.map((c) => (
                <Table.Th key={c.key}>{t(c.labelKey)}</Table.Th>
              ))}
              <Table.Th style={{ ...STICKY_RIGHT, background: OPAQUE_BG, zIndex: 3 }}>
                {t("web.soil.col.status")}
                <Text span size="xs" c="dimmed">
                  {" / "}
                  {t("web.soil.col.actions")}
                </Text>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {layers.map((layer, i) => {
              const fam = soilFamily(layer);
              const base = baseLayers?.find((b) => b.id === layer.id);
              const boundsChanged =
                baseLayers !== undefined &&
                (!base || Math.abs(base.top - layer.top) > 1e-6 || Math.abs(base.bottom - layer.bottom) > 1e-6);
              const status = layerParamStatus(layer, { approvalsStale: boundsChanged });
              const staleApproval = boundsChanged && hasApprovedSelection(layer);
              const selected = layer.id === selectedId;
              const rowHasError = issues.some((iss) => iss.index === i);
              const stickyBg = selected ? SELECTED_BG : OPAQUE_BG;
              return (
                <Table.Tr
                  key={`${i}-${layer.id}`}
                  onClick={() => onSelect?.(layer.id, i)}
                  aria-selected={selected || undefined}
                  style={{
                    background: selected ? "var(--mantine-color-blue-light)" : undefined,
                    cursor: onSelect ? "pointer" : undefined,
                  }}
                >
                  <Table.Td
                    style={{
                      ...STICKY_LEFT,
                      background: stickyBg,
                      boxShadow: rowHasError
                        ? "inset 3px 0 0 var(--mantine-color-red-filled), inset -1px 0 0 var(--mantine-color-default-border)"
                        : STICKY_LEFT.boxShadow,
                    }}
                  >
                    <Group gap={6} wrap="nowrap">
                      <SoilSwatch family={fam} scheme={scheme} title={t(SOIL_FAMILY_LABEL_KEY[fam])} />
                      <CommitTextInput
                        value={layer.id}
                        monospace
                        width={64}
                        ariaLabel={`${t("ui.layer.id")} ${i + 1}`}
                        error={fieldError(i, "id")}
                        onCommit={(v) => onChange(renameLayer(layers, i, v))}
                      />
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <CommitNumberInput
                      value={layer.top}
                      width={60}
                      readOnly={i === 0}
                      ariaLabel={`${t("ui.layer.top")} ${layer.id}`}
                      error={fieldError(i, "top")}
                      onCommit={(v) => {
                        if (v !== null && i > 0) onChange(setBoundary(layers, i - 1, v));
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <CommitNumberInput
                      value={layer.bottom}
                      width={60}
                      ariaLabel={`${t("ui.layer.bottom")} ${layer.id}`}
                      error={fieldError(i, "bottom")}
                      onCommit={(v) => {
                        if (v !== null) onChange(setBoundary(layers, i, v));
                      }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <CommitTextInput
                      value={layer.description ?? ""}
                      width={170}
                      ariaLabel={`${t("ui.layer.description")} ${layer.id}`}
                      onCommit={(v) => onChange(updateLayer(layers, i, { description: v }))}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      w={92}
                      data={USCS_OPTIONS}
                      value={layer.uscs ?? null}
                      searchable
                      clearable
                      placeholder="—"
                      aria-label={`${t("ui.layer.uscs")} ${layer.id}`}
                      comboboxProps={{ withinPortal: true }}
                      maxDropdownHeight={260}
                      onChange={(v) => onChange(updateLayer(layers, i, { uscs: v ?? null }))}
                      styles={{ input: { paddingInline: 6, fontFamily: "var(--mantine-font-family-monospace)" } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      w={100}
                      allowDeselect={false}
                      data={[
                        { value: "drained", label: t("web.soil.behaviour.drained") },
                        { value: "undrained", label: t("web.soil.behaviour.undrained") },
                      ]}
                      value={layer.behaviour ?? "drained"}
                      aria-label={`${t("ui.layer.behaviour")} ${layer.id}`}
                      comboboxProps={{ withinPortal: true }}
                      onChange={(v) => {
                        if (v === "drained" || v === "undrained") onChange(updateLayer(layers, i, { behaviour: v }));
                      }}
                      styles={{ input: { paddingInline: 6 } }}
                    />
                  </Table.Td>
                  <Table.Td>
                    <CommitNumberInput
                      value={layer.gamma}
                      width={54}
                      ariaLabel={`${t("ui.layer.gamma")} ${layer.id}`}
                      error={fieldError(i, "gamma")}
                      onCommit={(v) => onChange(updateLayer(layers, i, { gamma: v ?? Number.NaN }))}
                    />
                  </Table.Td>
                  <Table.Td>
                    <CommitNumberInput
                      value={layer.gamma_sat}
                      width={54}
                      placeholder={Number.isFinite(layer.gamma) ? String(layer.gamma) : undefined}
                      ariaLabel={`${t("ui.layer.gamma_sat")} ${layer.id}`}
                      error={fieldError(i, "gamma_sat")}
                      onCommit={(v) => onChange(updateLayer(layers, i, { gamma_sat: v }))}
                    />
                  </Table.Td>
                  {DESIGN_COLUMNS.map((c) => (
                    <Table.Td key={c.key}>
                      <CommitNumberInput
                        value={layer.design?.[c.key] ?? null}
                        width={c.width}
                        decimalScale={c.decimals === 0 ? 0 : 3}
                        ariaLabel={`${t(c.labelKey)} ${layer.id}`}
                        error={fieldError(i, c.key)}
                        onCommit={(v) => onChange(updateDesign(layers, i, c.key, v))}
                      />
                    </Table.Td>
                  ))}
                  <Table.Td style={{ ...STICKY_RIGHT, background: stickyBg }}>
                    <Group gap={4} wrap="nowrap" justify="space-between">
                    <Tooltip
                      label={t(staleApproval ? "web.soil.status_hint.stale" : `web.soil.status_hint.${status}`)}
                      openDelay={300}
                      multiline
                      w={240}
                    >
                      <Badge
                        size="xs"
                        variant="light"
                        color={PARAM_STATUS_COLOR[status]}
                        style={{ flexShrink: 0, overflow: "visible" }}
                      >
                        {t(`web.soil.status.${status}`)}
                      </Badge>
                    </Tooltip>
                    <Group gap={0} wrap="nowrap">
                      <Tooltip label={t("web.soil.action.add_below")} openDelay={400}>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          aria-label={`${t("web.soil.action.add_below")} ${layer.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(insertBelow(layers, i, opts));
                          }}
                        >
                          <IconRowInsertBottom size={15} />
                        </ActionIcon>
                      </Tooltip>
                      <SplitAction
                        layer={layer}
                        disabled={!(layer.bottom > layer.top)}
                        onSplit={(depth) => {
                          const next = splitLayer(layers, i, depth, opts);
                          if (next === layers) return false;
                          onChange(next);
                          return true;
                        }}
                      />
                      <Tooltip label={t("web.soil.action.merge_next")} openDelay={400}>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          disabled={i >= layers.length - 1}
                          aria-label={`${t("web.soil.action.merge_next")} ${layer.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(mergeWithNext(layers, i));
                          }}
                        >
                          <IconArrowMergeAltLeft size={15} style={{ transform: "rotate(-90deg)" }} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t("web.soil.action.delete")} openDelay={400}>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          disabled={layers.length === 1 && !allowEmpty}
                          aria-label={`${t("web.soil.action.delete")} ${layer.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onChange(removeLayer(layers, i, { allowEmpty }));
                          }}
                        >
                          <IconTrash size={15} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {issues.length > 0 && <IssueList issues={issues} layers={layers} />}
    </Stack>
  );
}

export function IssueList({ issues, layers }: { issues: LayerIssue[]; layers: SoilLayer[] }) {
  const { t } = useTranslation();
  const shown = issues.slice(0, 8);
  return (
    <List size="xs" spacing={2} c="red" role="alert">
      {shown.map((iss, k) => (
        <List.Item key={`${iss.code}-${iss.index ?? "x"}-${k}`}>
          {iss.index !== undefined && layers[iss.index] ? (
            <Text span ff="monospace" fw={600} size="xs">
              {layers[iss.index].id || `#${iss.index + 1}`}:{" "}
            </Text>
          ) : null}
          {t(layerErrorKey(iss.code), iss.params ?? {})}
        </List.Item>
      ))}
      {issues.length > shown.length && (
        <List.Item>{t("web.soil.more_issues", { count: issues.length - shown.length })}</List.Item>
      )}
    </List>
  );
}
