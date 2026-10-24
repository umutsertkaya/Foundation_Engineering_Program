import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  NativeSelect,
  NumberInput,
  Radio,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import type {
  GammaSource,
  LayeringProposal,
  LayeringSettings,
  ProposedLayer,
  SoilProfile,
  SuppliedGamma,
} from "../../../shared/api/types";
import {
  create_profile,
  list_investigations,
  propose_combined_layers,
  propose_cpt_layers,
  propose_spt_layers,
} from "../api";
import type { InvestigationsDTO } from "../types";
import { LatestGuard } from "../latest";
import { ErrorAlert } from "./ErrorAlert";
import { WarningList } from "./WarningList";

export type LayeringKind = "cpt" | "spt";

type MethodId = LayeringSettings["method"];
type NumericSetting = "smoothing_window" | "min_thickness" | "merge_ic_tol" | "n_change_ratio";

const METHODS: Record<LayeringKind, MethodId[]> = {
  cpt: ["cpt_ic", "combined"],
  spt: ["spt_log", "spt_uscs_n"],
};
const SETTING_FIELDS: Record<LayeringKind, NumericSetting[]> = {
  cpt: ["smoothing_window", "min_thickness", "merge_ic_tol"],
  spt: ["min_thickness", "n_change_ratio"],
};
const GAMMA_SOURCES: GammaSource[] = ["user", "lab", "phase", "cpt_rc2010", "spt_bowles"];
const NOT_ALIGNED_CODE = "layering.warning.depth_not_aligned";

interface Props {
  /** `cpt` also offers the combined CPT + borehole method; `spt` layers one borehole. */
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

function positive(value: number | string | null | undefined): value is number {
  return finite(value ?? "") && (value as number) > 0;
}

export function LayeringModal({ kind, onClose, onCreated }: Props) {
  return (
    <Modal opened={kind !== null} onClose={onClose} size="min(1040px, 96vw)" title={null} withCloseButton centered={false}>
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
  // Only the cells the engineer typed in; every other cell shows the server suggestion.
  const [userGamma, setUserGamma] = useState<Record<number, number | string>>({});
  const [userSat, setUserSat] = useState<Record<number, number | string>>({});
  const [resolutions, setResolutions] = useState<Record<number, "uscs" | "cpt">>({});
  const [boreholeIds, setBoreholeIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [gwt, setGwt] = useState<number | string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const guard = useRef(new LatestGuard());
  const lastRequest = useRef<{ settings: LayeringSettings; cpt: string; boreholes: string[]; supplied: string } | null>(null);

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

  const combined = method === "combined";
  const sources = useMemo(
    () => (kind === "cpt" ? (data?.cpts ?? []) : (data?.boreholes ?? [])).map((s) => s.id),
    [data, kind],
  );
  const boreholeOptions = useMemo(() => (data?.boreholes ?? []).map((b) => b.id), [data]);

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

  const buildSettings = (): LayeringSettings => {
    // Send only what the engineer typed; everything else keeps the server default.
    const settings: LayeringSettings = { method };
    for (const field of SETTING_FIELDS[kind]) {
      const value = values[field];
      if (finite(value ?? "")) settings[field] = value as number;
    }
    return settings;
  };

  const request = (
    settings: LayeringSettings,
    cpt: string,
    boreholes: string[],
    supplied: Record<number, SuppliedGamma>,
  ): Promise<LayeringProposal> => {
    if (settings.method === "combined") return propose_combined_layers(cpt, boreholes, settings, supplied);
    return kind === "cpt"
      ? propose_cpt_layers(cpt, { ...settings, supplied_gamma: supplied })
      : propose_spt_layers(cpt, { ...settings, supplied_gamma: supplied });
  };

  const propose = async () => {
    if (!sourceId || (combined && boreholeIds.length === 0)) return;
    const token = guard.current.begin();
    setBusy(true);
    setRefreshing(false);
    setError(null);
    const settings = buildSettings();
    try {
      const result = await request(settings, sourceId, boreholeIds, {});
      if (!guard.current.isCurrent(token)) return;
      lastRequest.current = { settings, cpt: sourceId, boreholes: boreholeIds, supplied: "{}" };
      setProposal(result);
      setOutdated(false);
      setUserGamma({});
      setUserSat({});
      setResolutions({});
      setName(t("soil.layering.default_name", { source: result.source_id }));
      const source = (kind === "cpt" ? data?.cpts : data?.boreholes)?.find((s) => s.id === sourceId);
      setGwt(source?.gwt_depth ?? "");
    } catch (err) {
      if (guard.current.isCurrent(token)) setError(err);
    } finally {
      if (guard.current.isCurrent(token)) setBusy(false);
    }
  };

  // What the table shows: the engineer's entry when there is one, otherwise the server suggestion.
  const gammaOf = (i: number): number | string =>
    i in userGamma ? userGamma[i] : (proposal?.layers[i].gamma_suggested ?? "");
  const satOf = (i: number): number | string =>
    i in userSat ? userSat[i] : (proposal?.layers[i].gamma_sat_suggested ?? "");

  const suppliedNow = (): Record<number, SuppliedGamma> => {
    const supplied: Record<number, SuppliedGamma> = {};
    const indexes = new Set([...Object.keys(userGamma), ...Object.keys(userSat)].map(Number));
    for (const i of [...indexes].sort((a, b) => a - b)) {
      const gamma = gammaOf(i);
      if (!positive(gamma)) continue; // the server needs a gamma; an empty cell supplies nothing
      const sat = satOf(i);
      supplied[i] = { gamma, gamma_sat: positive(sat) ? sat : null };
    }
    return supplied;
  };

  // Leaving a γ / γsat cell re-asks the server so the suggestions of the layers below follow the new value.
  const refreshSuggestions = async () => {
    const last = lastRequest.current;
    if (!proposal || !last || outdated) return;
    const supplied = suppliedNow();
    const key = JSON.stringify(supplied);
    if (key === last.supplied) return;
    const token = guard.current.begin();
    setRefreshing(true);
    setError(null);
    try {
      const result = await request(last.settings, last.cpt, last.boreholes, supplied);
      if (!guard.current.isCurrent(token)) return;
      lastRequest.current = { ...last, supplied: key };
      setProposal(result);
    } catch (err) {
      if (guard.current.isCurrent(token)) setError(err);
    } finally {
      if (guard.current.isCurrent(token)) setRefreshing(false);
    }
  };

  const conflictIndexes = proposal ? proposal.layers.flatMap((l, i) => (l.conflict ? [i] : [])) : [];
  const conflictsOpen = conflictIndexes.some((i) => !(i in resolutions));
  const gammasComplete = proposal ? proposal.layers.every((_, i) => positive(gammaOf(i))) : false;
  const gwtValid = finite(gwt) && gwt >= 0;
  const canCreate =
    proposal !== null && !outdated && !refreshing && gammasComplete && !conflictsOpen && gwtValid && name.trim().length > 0;

  const create = async () => {
    if (!proposal || !canCreate) return;
    setBusy(true);
    setError(null);
    // The unit weights and the conflict choices are the engineer's, and the only edits made to the proposal.
    const supplied: LayeringProposal = {
      ...proposal,
      layers: proposal.layers.map((layer, i) => ({
        ...layer,
        gamma_suggested: gammaOf(i) as number,
        gamma_sat_suggested: positive(satOf(i)) ? (satOf(i) as number) : null,
        ...(layer.conflict ? { resolution: resolutions[i] } : {}),
      })),
    };
    try {
      const created = await create_profile({
        name: name.trim(),
        origin: proposal.settings.method === "combined" ? "mixed" : kind,
        source_ids: proposal.source_ids?.length ? proposal.source_ids : [proposal.source_id],
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

  const sourceText = (source: GammaSource | null | undefined, range: ProposedLayer["gamma_range"]): string | null => {
    if (!source || !GAMMA_SOURCES.includes(source)) return null;
    if (source === "spt_bowles") {
      return range
        ? t("soil.layering.gamma_source.spt_bowles", { low: range[0], high: range[1] })
        : t("soil.layering.gamma_source.spt_bowles_plain");
    }
    return t(`soil.layering.gamma_source.${source}`);
  };

  const conflictText = (layer: ProposedLayer): string => {
    const c = layer.conflict;
    if (!c) return "";
    return t("soil.layering.conflict.text", {
      group: t(`soil.layering.conflict.cpt_${c.cpt}`),
      ic: fmt(c.ic_mean, 1, t("web.common.none")),
      uscs: c.uscs ?? t("web.common.none"),
    });
  };

  const noSources = data !== null && sources.length === 0;
  const effective = proposal?.settings;
  const isCombinedProposal = effective?.method === "combined";
  const notAligned = proposal?.warnings.some((w) => w.startsWith(NOT_ALIGNED_CODE)) ?? false;
  const otherSources = proposal ? (proposal.source_ids ?? []).filter((id) => id !== proposal.source_id) : [];
  const showIc = kind === "cpt";

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

          {combined && (
            <Checkbox.Group
              label={t("soil.layering.boreholes")}
              size="xs"
              value={boreholeIds}
              onChange={(v) => {
                setBoreholeIds(v);
                invalidate();
              }}
              error={boreholeIds.length === 0 ? t("soil.layering.boreholes_required") : undefined}
              data-testid="layering-boreholes"
            >
              <Group mt={4} gap="md">
                {boreholeOptions.map((id) => (
                  <Checkbox key={id} value={id} label={id} size="xs" disabled={busy} data-testid={`layering-borehole-${id}`} />
                ))}
              </Group>
            </Checkbox.Group>
          )}

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
            <Button
              size="xs"
              onClick={() => void propose()}
              loading={busy && proposal === null}
              disabled={!sourceId || busy || (combined && boreholeIds.length === 0)}
              data-testid="layering-propose"
            >
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
          {isCombinedProposal && otherSources.length > 0 && (
            <Stack gap={0} data-testid="layering-distances">
              {otherSources.map((id) => {
                const distance = proposal.distances?.[id];
                return (
                  <Text key={id} size="xs" data-testid={`layering-distance-${id}`}>
                    {typeof distance === "number"
                      ? t("soil.layering.distance", { id, distance: distance.toFixed(1) })
                      : t("soil.layering.distance_unknown", { id })}
                  </Text>
                );
              })}
            </Stack>
          )}
          {notAligned && (
            <Alert color="yellow" variant="light" p="xs" data-testid="layering-not-aligned">
              <Text size="xs">{t("soil.layering.not_aligned")}</Text>
            </Alert>
          )}
          {outdated && (
            <Alert color="yellow" variant="light" p="xs">
              <Text size="xs">{t("soil.layering.stale")}</Text>
            </Alert>
          )}

          <Table.ScrollContainer minWidth={isCombinedProposal ? 820 : 640} type="native">
            <Table striped withTableBorder withColumnBorders fz="xs" verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("soil.layering.col.top")}</Table.Th>
                  <Table.Th>{t("soil.layering.col.bottom")}</Table.Th>
                  {isCombinedProposal && <Table.Th>{t("soil.layering.col.boundary")}</Table.Th>}
                  <Table.Th>{t("soil.layering.col.description")}</Table.Th>
                  <Table.Th>{t("soil.layering.col.uscs")}</Table.Th>
                  <Table.Th>{kind === "cpt" ? t("soil.layering.col.zone") : t("soil.layering.col.n60")}</Table.Th>
                  {showIc && <Table.Th>{t("soil.layering.col.ic")}</Table.Th>}
                  <Table.Th>{t("soil.layering.col.behaviour")}</Table.Th>
                  <Table.Th>{t("soil.layering.col.gamma")}</Table.Th>
                  <Table.Th>{t("soil.layering.col.gamma_sat")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {proposal.layers.map((layer, i) => {
                  const gammaSource = i in userGamma ? (positive(userGamma[i]) ? "user" : null) : layer.gamma_source;
                  const satSource = i in userSat ? (positive(userSat[i]) ? "user" : null) : layer.gamma_sat_source;
                  const gammaLabel = sourceText(gammaSource, i in userGamma ? null : layer.gamma_range);
                  const satLabel = sourceText(satSource, i in userSat ? null : layer.gamma_range);
                  const satMissing = finite(gwt) && layer.bottom > gwt && !positive(satOf(i));
                  return (
                    <Table.Tr
                      key={`${layer.top}-${layer.bottom}`}
                      data-testid={`layering-row-${i}`}
                      data-conflict={layer.conflict ? "true" : undefined}
                      style={layer.conflict ? { backgroundColor: "var(--mantine-color-red-light)" } : undefined}
                    >
                      <Table.Td>{layer.top}</Table.Td>
                      <Table.Td>{layer.bottom}</Table.Td>
                      {isCombinedProposal && (
                        <Table.Td data-testid={`layering-boundary-${i}`}>
                          {layer.top_source ? t(`soil.layering.boundary.${layer.top_source}`) : t("web.common.none")}
                        </Table.Td>
                      )}
                      <Table.Td>
                        {layer.description || t("web.common.none")}
                        {layer.conflict && (
                          <Stack gap={4} mt={4}>
                            <Text size="xs" c="red.8" fw={600} data-testid={`layering-conflict-${i}`}>
                              {conflictText(layer)}
                            </Text>
                            <Radio.Group
                              size="xs"
                              aria-label={t("soil.layering.resolution.label")}
                              value={resolutions[i] ?? ""}
                              onChange={(v) => setResolutions((prev) => ({ ...prev, [i]: v as "uscs" | "cpt" }))}
                            >
                              <Group gap="sm">
                                <Radio
                                  size="xs"
                                  value="uscs"
                                  label={t("soil.layering.resolution.uscs")}
                                  disabled={busy}
                                  data-testid={`layering-resolution-${i}-uscs`}
                                />
                                <Radio
                                  size="xs"
                                  value="cpt"
                                  label={t("soil.layering.resolution.cpt")}
                                  disabled={busy}
                                  data-testid={`layering-resolution-${i}-cpt`}
                                />
                              </Group>
                            </Radio.Group>
                          </Stack>
                        )}
                      </Table.Td>
                      <Table.Td>{layer.uscs ?? t("web.common.none")}</Table.Td>
                      <Table.Td>{kind === "cpt" ? (layer.sbtn_zone ?? t("web.common.none")) : fmt(layer.n60_mean, 1, t("web.common.none"))}</Table.Td>
                      {showIc && <Table.Td>{fmt(layer.ic_mean, 2, t("web.common.none"))}</Table.Td>}
                      <Table.Td>{t(`soil.layering.behaviour.${layer.behaviour}`)}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          w={92}
                          min={0}
                          decimalScale={2}
                          hideControls
                          disabled={busy}
                          aria-label={t("soil.layering.col.gamma")}
                          placeholder={t("soil.layering.gamma_enter")}
                          value={gammaOf(i)}
                          onChange={(v) => setUserGamma((prev) => ({ ...prev, [i]: v }))}
                          onBlur={() => void refreshSuggestions()}
                          data-testid={`layering-gamma-${i}`}
                        />
                        {gammaLabel && (
                          <Text size="10px" c="dimmed" lh={1.2} mt={2} data-testid={`layering-gamma-source-${i}`}>
                            {gammaLabel}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          w={92}
                          min={0}
                          decimalScale={2}
                          hideControls
                          disabled={busy}
                          aria-label={t("soil.layering.col.gamma_sat")}
                          value={satOf(i)}
                          onChange={(v) => setUserSat((prev) => ({ ...prev, [i]: v }))}
                          onBlur={() => void refreshSuggestions()}
                          data-testid={`layering-gamma-sat-${i}`}
                        />
                        {satLabel && (
                          <Text size="10px" c="dimmed" lh={1.2} mt={2} data-testid={`layering-gamma-sat-source-${i}`}>
                            {satLabel}
                          </Text>
                        )}
                        {satMissing && (
                          <Text size="10px" c="orange.8" lh={1.2} mt={2} data-testid={`layering-gamma-sat-missing-${i}`}>
                            {t("soil.params.gamma_sat_missing_short")}
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Stack gap={4}>
            {refreshing && (
              <Text size="xs" c="dimmed" data-testid="layering-gamma-refreshing">
                {t("soil.layering.gamma_refreshing")}
              </Text>
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
            <Text size="xs" c="dimmed" data-testid="layering-create-hint">
              {canCreate ? "" : conflictsOpen ? t("soil.layering.create_blocked_conflict") : t("soil.layering.create_blocked")}
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="default" onClick={onClose}>
                {t("web.common.close")}
              </Button>
              <Button size="xs" onClick={() => void create()} disabled={!canCreate || busy} loading={busy && proposal !== null && !refreshing} data-testid="layering-create">
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
