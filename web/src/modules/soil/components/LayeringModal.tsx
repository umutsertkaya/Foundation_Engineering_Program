import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  NativeSelect,
  NumberInput,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { LayeringProposal, LayeringSettings, SoilProfile } from "../../../shared/api/types";
import { create_profile, list_investigations, propose_cpt_layers, propose_spt_layers } from "../api";
import type { InvestigationsDTO } from "../types";
import { LatestGuard } from "../latest";
import { ErrorAlert } from "./ErrorAlert";
import { WarningList } from "./WarningList";

export type LayeringKind = "cpt" | "spt";

type MethodId = LayeringSettings["method"];
type NumericSetting = "smoothing_window" | "min_thickness" | "merge_ic_tol" | "n_change_ratio";

const METHODS: Record<LayeringKind, MethodId[]> = {
  cpt: ["cpt_ic"],
  spt: ["spt_log", "spt_uscs_n"],
};
const SETTING_FIELDS: Record<LayeringKind, NumericSetting[]> = {
  cpt: ["smoothing_window", "min_thickness", "merge_ic_tol"],
  spt: ["min_thickness", "n_change_ratio"],
};

interface Props {
  kind: LayeringKind | null;
  onClose: () => void;
  /** Called with the profile the server created from the proposal. */
  onCreated: (profile: SoilProfile) => void;
}

/** Display-only rounding; the raw values are what gets submitted. */
function fmt(value: number | null | undefined, digits: number, empty: string): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : empty;
}

function finite(value: number | string): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function LayeringModal({ kind, onClose, onCreated }: Props) {
  return (
    <Modal opened={kind !== null} onClose={onClose} size="xl" title={null} withCloseButton centered={false}>
      {kind && <LayeringBody key={kind} kind={kind} onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

function LayeringBody({ kind, onClose, onCreated }: { kind: LayeringKind; onClose: () => void; onCreated: Props["onCreated"] }) {
  const { t } = useTranslation();
  const [data, setData] = useState<InvestigationsDTO | null>(null);
  const [sourceId, setSourceId] = useState<string>("");
  const [method, setMethod] = useState<MethodId>(METHODS[kind][0]);
  const [values, setValues] = useState<Partial<Record<NumericSetting, number | string>>>({});
  const [proposal, setProposal] = useState<LayeringProposal | null>(null);
  const [outdated, setOutdated] = useState(false);
  const [gammas, setGammas] = useState<Record<number, number | string>>({});
  const [name, setName] = useState("");
  const [gwt, setGwt] = useState<number | string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const guard = useRef(new LatestGuard());

  useEffect(() => {
    let cancelled = false;
    list_investigations()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        const first = kind === "cpt" ? res.cpts[0]?.id : res.boreholes[0]?.id;
        if (first) setSourceId(first);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
      guard.current.cancel();
    };
  }, [kind]);

  const sources = useMemo(
    () => (kind === "cpt" ? (data?.cpts ?? []) : (data?.boreholes ?? [])).map((s) => s.id),
    [data, kind],
  );

  const sourceDepth = useMemo(() => {
    const depths =
      kind === "cpt"
        ? data?.cpts.find((c) => c.id === sourceId)?.depth
        : data?.boreholes.find((b) => b.id === sourceId)?.spt?.map((r) => r.depth);
    if (!depths) return null;
    return depths.length > 0 ? Math.max(...depths) : null;
  }, [data, kind, sourceId]);

  const invalidate = () => {
    if (proposal) setOutdated(true);
  };

  const propose = async () => {
    if (!sourceId) return;
    const token = guard.current.begin();
    setBusy(true);
    setError(null);
    // Send only what the engineer typed; everything else keeps the server default.
    const settings: LayeringSettings = { method };
    for (const field of SETTING_FIELDS[kind]) {
      const value = values[field];
      if (finite(value ?? "")) settings[field] = value as number;
    }
    try {
      const result =
        kind === "cpt" ? await propose_cpt_layers(sourceId, settings) : await propose_spt_layers(sourceId, settings);
      if (!guard.current.isCurrent(token)) return;
      setProposal(result);
      setOutdated(false);
      setGammas({});
      setName(t("soil.layering.default_name", { source: result.source_id }));
      const source = (kind === "cpt" ? data?.cpts : data?.boreholes)?.find((s) => s.id === sourceId);
      setGwt(source?.gwt_depth ?? "");
    } catch (err) {
      if (guard.current.isCurrent(token)) setError(err);
    } finally {
      if (guard.current.isCurrent(token)) setBusy(false);
    }
  };

  // Every layer needs a unit weight the engineer confirmed or typed; a suggestion is never filled in silently.
  const suggestionOf = (i: number): number | null => proposal?.layers[i].gamma_suggested ?? null;
  const anySuggestion = proposal ? proposal.layers.some((_, i) => suggestionOf(i) !== null) : false;
  const gammasComplete = proposal
    ? proposal.layers.every((_, i) => finite(gammas[i] ?? "") && (gammas[i] as number) > 0)
    : false;
  const gwtValid = finite(gwt) && gwt >= 0;
  const canCreate = proposal !== null && !outdated && gammasComplete && gwtValid && name.trim().length > 0;

  const create = async () => {
    if (!proposal || !canCreate) return;
    setBusy(true);
    setError(null);
    // The unit weights are the engineer entries (confirmed suggestion or typed value) and the only edit made
    // to the proposal; the backend stores no provenance for them (open question: layer_gamma, gamma_sat).
    const supplied: LayeringProposal = {
      ...proposal,
      layers: proposal.layers.map((layer, i) => ({ ...layer, gamma_suggested: gammas[i] as number })),
    };
    try {
      const created = await create_profile({
        name: name.trim(),
        origin: kind,
        source_ids: [proposal.source_id],
        gwt: { depth_insitu: gwt as number },
        from_proposal: supplied,
      });
      onCreated(created);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const noSources = data !== null && sources.length === 0;
  const effective = proposal?.settings;

  return (
    <Stack gap="sm">
      <div>
        <Text fw={700} size="lg">
          {t(`soil.layering.title.${kind}`)}
        </Text>
        <Text size="xs" c="dimmed">
          {t("soil.layering.intro")}
        </Text>
        <Text size="xs" c="dimmed" data-testid="layering-stress-note">
          {t("soil.layering.stress_profile_note")}
        </Text>
      </div>

      <ErrorAlert error={error} onClose={() => setError(null)} sourceDepth={sourceDepth} />

      {noSources ? (
        <Alert color="blue" variant="light">
          <Text size="sm">{t(`soil.layering.no_sources.${kind}`)}</Text>
        </Alert>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <NativeSelect
              size="xs"
              label={t(`soil.layering.source.${kind}`)}
              data={sources}
              value={sourceId}
              disabled={busy}
              onChange={(e) => {
                setSourceId(e.currentTarget.value);
                invalidate();
              }}
              data-testid="layering-source"
            />
            <NativeSelect
              size="xs"
              label={t("soil.layering.method")}
              data={METHODS[kind].map((m) => ({ value: m, label: t(`soil.layering.method.${m}`) }))}
              value={method}
              disabled={busy || METHODS[kind].length === 1}
              onChange={(e) => {
                setMethod(e.currentTarget.value as MethodId);
                invalidate();
              }}
              data-testid="layering-method"
            />
          </SimpleGrid>

          <Stack gap={4}>
            <Text size="xs" fw={600}>
              {t("soil.layering.settings")}
            </Text>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="xs">
              {SETTING_FIELDS[kind].map((field) => (
                <NumberInput
                  key={field}
                  size="xs"
                  min={0}
                  decimalScale={3}
                  hideControls
                  label={t(`soil.layering.setting.${field}`)}
                  placeholder={t("soil.layering.default_placeholder")}
                  value={values[field] ?? ""}
                  disabled={busy}
                  onChange={(v) => {
                    setValues((prev) => ({ ...prev, [field]: v }));
                    invalidate();
                  }}
                  data-testid={`layering-setting-${field}`}
                />
              ))}
            </SimpleGrid>
          </Stack>

          <Group>
            <Button size="xs" onClick={() => void propose()} loading={busy && proposal === null} disabled={!sourceId || busy} data-testid="layering-propose">
              {t("soil.layering.propose")}
            </Button>
          </Group>
        </>
      )}

      {proposal && (
        <Stack gap="xs" data-testid="layering-proposal">
          <Divider />
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
            <Text fw={600} size="sm">
              {t("soil.layering.proposal", { source: proposal.source_id })}
            </Text>
            <Badge variant="light" color="orange" size="sm">
              {t("soil.layering.not_approved")}
            </Badge>
          </Group>
          {effective && (
            <Text size="xs" c="dimmed">
              {t("soil.layering.effective_settings")}:{" "}
              {t(`soil.layering.method.${effective.method}`)}
              {SETTING_FIELDS[kind]
                .filter((f) => effective[f] !== undefined)
                .map((f) => `; ${t(`soil.layering.setting.${f}`)} = ${effective[f]}`)
                .join("")}
            </Text>
          )}
          {outdated && (
            <Alert color="yellow" variant="light" p="xs">
              <Text size="xs">{t("soil.layering.stale")}</Text>
            </Alert>
          )}

          <Table.ScrollContainer minWidth={560} type="native">
            <Table striped withTableBorder withColumnBorders fz="xs" verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("soil.layering.col.top")}</Table.Th>
                  <Table.Th>{t("soil.layering.col.bottom")}</Table.Th>
                  <Table.Th>{t("soil.layering.col.description")}</Table.Th>
                  <Table.Th>{t("soil.layering.col.uscs")}</Table.Th>
                  <Table.Th>{kind === "cpt" ? t("soil.layering.col.zone") : t("soil.layering.col.n60")}</Table.Th>
                  {kind === "cpt" && <Table.Th>{t("soil.layering.col.ic")}</Table.Th>}
                  <Table.Th>{t("soil.layering.col.behaviour")}</Table.Th>
                  <Table.Th>{t("soil.layering.col.gamma")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {proposal.layers.map((layer, i) => (
                  <Table.Tr key={`${layer.top}-${layer.bottom}`} data-testid={`layering-row-${i}`}>
                    <Table.Td>{layer.top}</Table.Td>
                    <Table.Td>{layer.bottom}</Table.Td>
                    <Table.Td>{layer.description || t("web.common.none")}</Table.Td>
                    <Table.Td>{layer.uscs ?? t("web.common.none")}</Table.Td>
                    <Table.Td>{kind === "cpt" ? (layer.sbtn_zone ?? t("web.common.none")) : fmt(layer.n60_mean, 1, t("web.common.none"))}</Table.Td>
                    {kind === "cpt" && <Table.Td>{fmt(layer.ic_mean, 2, t("web.common.none"))}</Table.Td>}
                    <Table.Td>{t(`soil.layering.behaviour.${layer.behaviour}`)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <NumberInput
                          size="xs"
                          w={84}
                          min={0}
                          decimalScale={2}
                          hideControls
                          disabled={busy}
                          aria-label={t("soil.layering.gamma_enter")}
                          placeholder={t("soil.layering.gamma_enter")}
                          value={gammas[i] ?? ""}
                          onChange={(v) => setGammas((prev) => ({ ...prev, [i]: v }))}
                          data-testid={`layering-gamma-${i}`}
                        />
                        {suggestionOf(i) !== null && (
                          <Button
                            size="compact-xs"
                            variant="light"
                            disabled={busy}
                            onClick={() => setGammas((prev) => ({ ...prev, [i]: suggestionOf(i) as number }))}
                            data-testid={`layering-gamma-use-${i}`}
                          >
                            {t("soil.layering.gamma_use", { value: fmt(suggestionOf(i), 1, "") })}
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Stack gap={4}>
            {anySuggestion && (
              <Group gap="xs">
                <Button
                  size="compact-xs"
                  variant="default"
                  disabled={busy}
                  onClick={() =>
                    setGammas((prev) => {
                      const next = { ...prev };
                      proposal.layers.forEach((l, i) => {
                        if (l.gamma_suggested !== null && l.gamma_suggested !== undefined) next[i] = l.gamma_suggested;
                      });
                      return next;
                    })
                  }
                  data-testid="layering-gamma-use-all"
                >
                  {t("soil.layering.gamma_use_all")}
                </Button>
                {!gammasComplete && (
                  <Text size="xs" c="orange.8">
                    {t("soil.layering.gamma_confirm_needed")}
                  </Text>
                )}
              </Group>
            )}
            <Text size="xs" c="dimmed" data-testid="layering-gamma-note">
              {t("soil.layering.gamma_note")}
            </Text>
          </Stack>

          <Stack gap={2}>
            <Text size="xs" fw={600}>
              {t("soil.layering.warnings")}
            </Text>
            {proposal.warnings.length === 0 ? (
              <Text size="xs" c="dimmed">
                {t("soil.layering.no_warnings")}
              </Text>
            ) : (
              <WarningList warnings={proposal.warnings} testId="layering-warnings" />
            )}
          </Stack>

          <Divider />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              size="xs"
              label={t("soil.layering.profile_name")}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.currentTarget.value)}
              data-testid="layering-name"
            />
            <NumberInput
              size="xs"
              min={0}
              decimalScale={2}
              hideControls
              label={t("soil.layering.gwt")}
              description={t("soil.layering.gwt_hint")}
              value={gwt}
              disabled={busy}
              onChange={setGwt}
              data-testid="layering-gwt"
            />
          </SimpleGrid>
          <Group justify="space-between" wrap="wrap">
            <Text size="xs" c="dimmed">
              {canCreate ? "" : t("soil.layering.create_blocked")}
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="default" onClick={onClose}>
                {t("web.common.close")}
              </Button>
              <Button size="xs" onClick={() => void create()} disabled={!canCreate || busy} loading={busy && proposal !== null} data-testid="layering-create">
                {t("soil.layering.create")}
              </Button>
            </Group>
          </Group>
        </Stack>
      )}

      {!proposal && (
        <Group justify="flex-end">
          <Button size="xs" variant="default" onClick={onClose}>
            {t("web.common.close")}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
