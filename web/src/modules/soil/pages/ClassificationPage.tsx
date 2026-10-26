import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  classify_uscs,
  get_borehole_uscs,
  get_cpt_sbtn,
  get_sbtn_reference,
  get_uscs_reference,
  list_investigations,
} from "../api";
import type {
  BoreholeUSCSDTO,
  CPTSBTNDTO,
  InvestigationsDTO,
  SBTNReferenceDTO,
  USCSClassifyRequest,
  USCSItemDTO,
  USCSReferenceDTO,
} from "../types";
import { ErrorAlert } from "../components/ErrorAlert";
import { PageHeader } from "../../../shared/components/PageHeader";
import { WarningList } from "../components/WarningList";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PlasticityChart } from "../classification/PlasticityChart";
import { SbtnChart } from "../classification/SbtnChart";
import { ZONE_COLORS } from "../classification/geometry";

const DASH = "–";

function fmt(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? DASH : value.toFixed(digits);
}

function useIsTr(): boolean {
  const { i18n } = useTranslation();
  return i18n.language.startsWith("tr");
}

interface ZoneRow {
  zone: number;
  count: number;
  top: number | null;
  bottom: number | null;
}

/**
 * Per-zone sample count and depth extent; samples without a zone are not counted.
 * A sample stands for the interval down to the next sample (the last one for one sample spacing),
 * so a single-sample zone is not shown as a zero-thickness `x–x` row.
 */
export function summariseZones(points: CPTSBTNDTO["points"]): ZoneRow[] {
  const depths = points.map((p) => p.depth).filter((d): d is number => d !== null).sort((a, b) => a - b);
  const intervalEnd = (depth: number): number => {
    const i = depths.indexOf(depth);
    if (i < 0) return depth;
    const next = depths.find((d, j) => j > i && d > depth);
    if (next !== undefined) return next;
    const prev = [...depths].reverse().find((d) => d < depth);
    return prev === undefined ? depth : depth + (depth - prev);
  };
  const rows = new Map<number, ZoneRow>();
  for (const p of points) {
    if (p.zone === null) continue;
    const row = rows.get(p.zone) ?? { zone: p.zone, count: 0, top: null, bottom: null };
    row.count += 1;
    if (p.depth !== null) {
      const end = intervalEnd(p.depth);
      row.top = row.top === null ? p.depth : Math.min(row.top, p.depth);
      row.bottom = row.bottom === null ? end : Math.max(row.bottom, end);
    }
    rows.set(p.zone, row);
  }
  return [...rows.values()].sort((a, b) => a.zone - b.zone);
}

function CptSection({ cpts }: { cpts: InvestigationsDTO["cpts"] }) {
  const { t } = useTranslation();
  const isTr = useIsTr();
  const [cptId, setCptId] = useState<string | null>(cpts[0]?.id ?? null);
  const [reference, setReference] = useState<SBTNReferenceDTO | null>(null);
  const [result, setResult] = useState<CPTSBTNDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    if (cptId === null) return;
    setLoading(true);
    setError(null);
    setResult(null);
    void (async () => {
      try {
        const [ref, sbtn] = await Promise.all([reference ? Promise.resolve(reference) : get_sbtn_reference(), get_cpt_sbtn(cptId)]);
        if (mine !== seq.current) return;
        setReference(ref);
        setResult(sbtn);
      } catch (err) {
        if (mine === seq.current) setError(err);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    })();
    // `reference` is only a cache; reloading it must not retrigger the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cptId]);

  if (cpts.length === 0) {
    return <EmptyState title={t("soil.cls.sbtn.empty_title")} description={t("soil.cls.sbtn.empty_desc")} />;
  }

  const zoneName = (zone: number): string => {
    const z = reference?.zones.find((r) => r.zone === zone);
    return z ? (isTr ? z.name_tr : z.name_en) : DASH;
  };
  const rows = result ? summariseZones(result.points) : [];

  return (
    <Stack gap="md">
      <Select
        label={t("soil.cls.sbtn.select_cpt")}
        data={cpts.map((c) => ({ value: c.id, label: c.id }))}
        value={cptId}
        onChange={setCptId}
        allowDeselect={false}
        maw={280}
      />
      <ErrorAlert error={error} />
      {loading && <Text size="sm">{t("web.common.loading")}</Text>}
      {result && reference && (
        <>
          <WarningList warnings={result.warnings} size="sm" testId="sbtn-warnings" />
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Card withBorder padding="sm" radius="sm">
              <SbtnChart reference={reference} points={result.points} />
            </Card>
            <Stack gap="xs">
              <Title order={5}>{t("soil.cls.sbtn.zone_summary")}</Title>
              {rows.length === 0 ? (
                <Text size="sm" c="dimmed">{t("soil.cls.sbtn.no_zoned_points")}</Text>
              ) : (
                <Table withTableBorder withColumnBorders verticalSpacing={3} data-testid="sbtn-zone-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t("soil.cls.sbtn.col_zone")}</Table.Th>
                      <Table.Th>{t("soil.cls.sbtn.col_name")}</Table.Th>
                      <Table.Th>{t("soil.cls.sbtn.col_count")}</Table.Th>
                      <Table.Th>{t("soil.cls.sbtn.col_depth")}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((r) => (
                      <Table.Tr key={r.zone}>
                        <Table.Td>
                          <Badge size="sm" style={{ backgroundColor: ZONE_COLORS[r.zone] ?? "#9e9e9e" }}>{r.zone}</Badge>
                        </Table.Td>
                        <Table.Td>{zoneName(r.zone)}</Table.Td>
                        <Table.Td ff="monospace">{r.count}</Table.Td>
                        <Table.Td ff="monospace">{`${fmt(r.top, 2)} – ${fmt(r.bottom, 2)}`}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
              <Title order={6} mt="xs">{t("soil.cls.sbtn.legend")}</Title>
              <Table withTableBorder verticalSpacing={2} data-testid="sbtn-legend">
                <Table.Tbody>
                  {reference.zones.map((z) => (
                    <Table.Tr key={z.zone}>
                      <Table.Td w={36}>
                        <Badge size="xs" style={{ backgroundColor: ZONE_COLORS[z.zone] ?? "#9e9e9e" }}>{z.zone}</Badge>
                      </Table.Td>
                      <Table.Td><Text size="xs">{isTr ? z.name_tr : z.name_en}</Text></Table.Td>
                      <Table.Td ff="monospace">
                        <Text size="xs" ff="monospace">
                          {z.ic_min === null && z.ic_max === null
                            ? t("soil.cls.sbtn.zone1_rule")
                            : `Ic ${fmt(z.ic_min, 2)} – ${fmt(z.ic_max, 2)}`}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Text size="xs" c="dimmed">{t("soil.cls.sbtn.zones_89_note")}</Text>
            </Stack>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}

function UscsTable({ items }: { items: USCSItemDTO[] }) {
  const { t } = useTranslation();
  const isTr = useIsTr();
  return (
    <div style={{ overflowX: "auto" }}>
      <Table withTableBorder withColumnBorders verticalSpacing={3} data-testid="uscs-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("soil.cls.uscs.col_depth")}</Table.Th>
            <Table.Th>{t("soil.cls.uscs.col_symbol")}</Table.Th>
            <Table.Th>{t("soil.cls.uscs.col_name")}</Table.Th>
            <Table.Th>FC %</Table.Th>
            <Table.Th>{t("soil.cls.uscs.col_gravel")}</Table.Th>
            <Table.Th>LL</Table.Th>
            <Table.Th>PL</Table.Th>
            <Table.Th>PI</Table.Th>
            <Table.Th>Cu</Table.Th>
            <Table.Th>Cc</Table.Th>
            <Table.Th>{t("soil.cls.uscs.col_status")}</Table.Th>
            <Table.Th>{t("soil.cls.uscs.col_notes")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, i) => (
            <Table.Tr key={i}>
              <Table.Td ff="monospace">{fmt(item.depth, 2)}</Table.Td>
              <Table.Td>
                {item.symbol ? <Badge variant="light">{item.symbol}</Badge> : <Text size="xs" c="dimmed">{t("soil.cls.uscs.no_symbol")}</Text>}
              </Table.Td>
              <Table.Td><Text size="xs">{(isTr ? item.group_name_tr : item.group_name_en) ?? DASH}</Text></Table.Td>
              <Table.Td ff="monospace">{fmt(item.FC)}</Table.Td>
              <Table.Td ff="monospace">{fmt(item.gravel)}</Table.Td>
              <Table.Td ff="monospace">{fmt(item.LL)}</Table.Td>
              <Table.Td ff="monospace">{fmt(item.PL)}</Table.Td>
              <Table.Td ff="monospace">{fmt(item.PI)}</Table.Td>
              <Table.Td ff="monospace">{fmt(item.Cu, 2)}</Table.Td>
              <Table.Td ff="monospace">{fmt(item.Cc, 2)}</Table.Td>
              <Table.Td>
                <Badge size="xs" color={item.complete ? "teal" : "orange"} variant="light">
                  {item.complete ? t("soil.cls.uscs.complete") : t("soil.cls.uscs.incomplete")}
                </Badge>
              </Table.Td>
              <Table.Td>
                {item.notes.map((n, k) => (
                  <Text key={k} size="xs" style={{ overflowWrap: "anywhere" }}>{n}</Text>
                ))}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

type FormState = Record<"fines" | "gravel" | "LL" | "PI" | "D10" | "D30" | "D60", number | string>;
const EMPTY_FORM: FormState = { fines: "", gravel: "", LL: "", PI: "", D10: "", D30: "", D60: "" };

function orNull(v: number | string): number | null {
  return typeof v === "number" ? v : null;
}

function QuickClassify() {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [result, setResult] = useState<USCSItemDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const field = (key: keyof FormState, label: string, extra: { max?: number } = {}) => (
    <NumberInput
      key={key}
      label={label}
      value={form[key]}
      onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
      min={0}
      max={extra.max}
      decimalScale={3}
      hideControls
      required={key === "fines"}
    />
  );

  const submit = async () => {
    const fines = orNull(form.fines);
    if (fines === null) return;
    const payload: USCSClassifyRequest = {
      fines,
      gravel: orNull(form.gravel),
      LL: orNull(form.LL),
      PI: orNull(form.PI),
      D10: orNull(form.D10),
      D30: orNull(form.D30),
      D60: orNull(form.D60),
    };
    setBusy(true);
    setError(null);
    try {
      setResult(await classify_uscs(payload));
    } catch (err) {
      setResult(null);
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card withBorder padding="sm" radius="sm">
      <Stack gap="xs">
        <Title order={5}>{t("soil.cls.uscs.quick_title")}</Title>
        <Text size="xs" c="dimmed">{t("soil.cls.uscs.quick_hint")}</Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
          {field("fines", t("soil.cls.uscs.in_fines"), { max: 100 })}
          {field("gravel", t("soil.cls.uscs.in_gravel"), { max: 100 })}
          {field("LL", "LL")}
          {field("PI", "PI")}
          {field("D10", "D10 (mm)")}
          {field("D30", "D30 (mm)")}
          {field("D60", "D60 (mm)")}
        </SimpleGrid>
        <Group>
          <Button size="xs" onClick={() => void submit()} loading={busy} disabled={orNull(form.fines) === null}>
            {t("soil.cls.uscs.classify")}
          </Button>
        </Group>
        <ErrorAlert error={error} />
        {result && <UscsTable items={[result]} />}
      </Stack>
    </Card>
  );
}

function UscsSection({ boreholes }: { boreholes: InvestigationsDTO["boreholes"] }) {
  const { t } = useTranslation();
  const isTr = useIsTr();
  const [bhId, setBhId] = useState<string | null>(boreholes[0]?.id ?? null);
  const [reference, setReference] = useState<USCSReferenceDTO | null>(null);
  const [data, setData] = useState<BoreholeUSCSDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    setData(null);
    void (async () => {
      try {
        const [ref, uscs] = await Promise.all([
          reference ? Promise.resolve(reference) : get_uscs_reference(),
          bhId === null ? Promise.resolve(null) : get_borehole_uscs(bhId),
        ]);
        if (mine !== seq.current) return;
        setReference(ref);
        setData(uscs);
      } catch (err) {
        if (mine === seq.current) setError(err);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    })();
    // `reference` is only a cache; reloading it must not retrigger the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bhId]);

  return (
    <Stack gap="md">
      {boreholes.length === 0 ? (
        <EmptyState title={t("soil.cls.uscs.empty_title")} description={t("soil.cls.uscs.empty_desc")} />
      ) : (
        <Select
          label={t("soil.cls.uscs.select_borehole")}
          data={boreholes.map((b) => ({ value: b.id, label: b.id }))}
          value={bhId}
          onChange={setBhId}
          allowDeselect={false}
          maw={280}
        />
      )}
      <ErrorAlert error={error} />
      {loading && <Text size="sm">{t("web.common.loading")}</Text>}
      {data && reference && (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Card withBorder padding="sm" radius="sm">
            <PlasticityChart reference={reference} items={data.items} />
          </Card>
          <Stack gap="xs">
            {data.items.length === 0 ? (
              <Text size="sm" c="dimmed">{t("soil.cls.uscs.no_lab")}</Text>
            ) : (
              <UscsTable items={data.items} />
            )}
          </Stack>
        </SimpleGrid>
      )}
      <QuickClassify />
      {reference && (
        <Stack gap="xs">
          <Title order={5}>{t("soil.cls.uscs.symbols_title")}</Title>
          <div style={{ overflowX: "auto" }}>
            <Table withTableBorder verticalSpacing={2} data-testid="uscs-symbols">
              <Table.Tbody>
                {reference.symbols.map((s) => (
                  <Table.Tr key={s.symbol}>
                    <Table.Td w={90}><Badge variant="light">{s.symbol}</Badge></Table.Td>
                    <Table.Td><Text size="xs">{isTr ? s.group_name_tr : s.group_name_en}</Text></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{s.description}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </Stack>
      )}
    </Stack>
  );
}

export function ClassificationPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InvestigationsDTO | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await list_investigations());
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack gap="md">
      <PageHeader title={t("soil.cls.title")} lead={t("soil.cls.subtitle")} />
      <Alert color="blue" variant="light" data-testid="cls-scope-note">
        <Text size="xs">{t("soil.cls.scope_note")}</Text>
      </Alert>
      <ErrorAlert error={error} />
      {data === null && error === null && <Text size="sm">{t("web.common.loading")}</Text>}
      {data && (
        <Tabs defaultValue="sbtn" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="sbtn">{t("soil.cls.tab_sbtn")}</Tabs.Tab>
            <Tabs.Tab value="uscs">{t("soil.cls.tab_uscs")}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="sbtn" pt="md">
            <CptSection cpts={data.cpts} />
          </Tabs.Panel>
          <Tabs.Panel value="uscs" pt="md">
            <UscsSection boreholes={data.boreholes} />
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
}
