import { useEffect, useMemo, useState } from "react";
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
import { ApiError } from "../../../shared/api/client";
import type { LayeringProposal, LayeringSettings, SoilProfile } from "../../../shared/api/types";
import { create_profile, list_investigations, propose_cpt_layers, propose_spt_layers } from "../api";
import type { InvestigationsDTO } from "../types";
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
  const [error, setError] = useState<ApiError | null>(null);

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
        if (!cancelled && err instanceof ApiError) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const sources = useMemo(
    () => (kind === "cpt" ? (data?.cpts ?? []) : (data?.boreholes ?? [])).map((s) => s.id),
    [data, kind],
  );

  const invalidate = () => {
    if (proposal) setOutdated(true);
  };

  const propose = async () => {
    if (!sourceId) return;
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
      setProposal(result);
      setOutdated(false);
      setGammas({});
      setName(t("soil.layering.default_name", { source: result.source_id }));
      const source = (kind === "cpt" ? data?.cpts : data?.boreholes)?.find((s) => s.id === sourceId);
      setGwt(source?.gwt_depth ?? "");
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  const needsGamma = (i: number) => proposal?.layers[i].gamma_suggested === null || proposal?.layers[i].gamma_suggested === undefined;
  const anyNeedsGamma = proposal ? proposal.layers.some((_, i) => needsGamma(i)) : false;
  const gammasComplete = proposal
    ? proposal.layers.every((_, i) => !needsGamma(i) || (finite(gammas[i] ?? "") && (gammas[i] as number) > 0))
    : false;
  const gwtValid = finite(gwt) && gwt >= 0;
  const canCreate = proposal !== null && !outdated && gammasComplete && gwtValid && name.trim().length > 0;

  const create = async () => {
    if (!proposal || !canCreate) return;
    setBusy(true);
    setError(null);
    // Unit weights the program could not suggest are the engineer's own entries; they are the only
    // edit made to the proposal (see the open question about `layer_gamma` in P1_CONTRACTS).
    const supplied: LayeringProposal = {
      ...proposal,
      layers: proposal.layers.map((layer, i) => ({
        ...layer,
        gamma_suggested: needsGamma(i) ? (gammas[i] as number) : layer.gamma_suggested,
      })),
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
      if (err instanceof ApiError) setError(err);
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
      </div>

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)} withCloseButton onClose={() => setError(null)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}

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
              disabled={METHODS[kind].length === 1}
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
                    <Table.Td>{kind === "cpt" ? (layer.sbtn_zone ?? t("web.common.none")) : (layer.n60_mean ?? t("web.common.none"))}</Table.Td>
                    {kind === "cpt" && <Table.Td>{layer.ic_mean ?? t("web.common.none")}</Table.Td>}
                    <Table.Td>{t(`soil.layering.behaviour.${layer.behaviour}`)}</Table.Td>
                    <Table.Td>
                      {needsGamma(i) ? (
                        <NumberInput
                          size="xs"
                          w={90}
                          min={0}
                          decimalScale={2}
                          hideControls
                          aria-label={t("soil.layering.gamma_enter")}
                          placeholder={t("soil.layering.gamma_enter")}
                          value={gammas[i] ?? ""}
                          onChange={(v) => setGammas((prev) => ({ ...prev, [i]: v }))}
                          data-testid={`layering-gamma-${i}`}
                        />
                      ) : (
                        <Text size="xs">
                          {layer.gamma_suggested}{" "}
                          <Text span size="xs" c="dimmed">
                            ({t("soil.layering.gamma_suggested")})
                          </Text>
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          {anyNeedsGamma && (
            <Text size="xs" c="dimmed">
              {t("soil.layering.gamma_needed")}
            </Text>
          )}

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
              <Button size="xs" onClick={() => void create()} disabled={!canCreate} loading={busy && proposal !== null} data-testid="layering-create">
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
