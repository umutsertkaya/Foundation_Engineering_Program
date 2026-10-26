import { useEffect, useState } from "react";
import { Button, Group, NumberInput, Select, Stack, Table, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { list_project_profiles } from "../../../shared/api/core";
import type { ProfileSummary } from "../../../shared/api/types";
import { PageHeader } from "../../../shared/components/PageHeader";
import { SectionCard } from "../../../shared/components/SectionCard";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { analyze_at_rest } from "../api";
import { AtRestDiagram } from "../components/AtRestDiagram";
import type { AtRestResultDTO } from "../types";

type GwtCase = "insitu" | "design" | "seismic";

const fmt = (v: number, digits = 2) => v.toFixed(digits);

/** At-rest (K0) pressure analysis: profile, H, q and water table case in; diagram, K0 table and resultants out. */
export function AtRestPage() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [height, setHeight] = useState<number | string>(6);
  const [surcharge, setSurcharge] = useState<number | string>(0);
  const [gwtCase, setGwtCase] = useState<GwtCase>("design");
  const [result, setResult] = useState<AtRestResultDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    list_project_profiles()
      .then((list) => {
        if (!live) return;
        setProfiles(list);
        setProfileId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((e) => {
        if (live) setError(e);
      });
    return () => {
      live = false;
    };
  }, []);

  const valid = profileId !== null && typeof height === "number" && height > 0 && typeof surcharge === "number" && surcharge >= 0;

  async function run() {
    if (!valid || profileId === null) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await analyze_at_rest({
          profile_id: profileId,
          height: height as number,
          surcharge: surcharge as number,
          gwt_case: gwtCase,
        }),
      );
    } catch (e) {
      setResult(null);
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="md" data-testid="at-rest-page">
      <PageHeader title={t("walls.at_rest.title")} lead={t("walls.at_rest.subtitle")} />

      {profiles !== null && profiles.length === 0 && <Text size="sm">{t("walls.at_rest.no_profiles")}</Text>}

      <SectionCard title={t("walls.at_rest.inputs")}>
      <Group align="flex-end" gap="sm">
        <Select
          label={t("walls.at_rest.profile")}
          data={(profiles ?? []).map((p) => ({ value: p.id, label: p.name }))}
          value={profileId}
          onChange={setProfileId}
          allowDeselect={false}
          w={220}
        />
        <NumberInput label={t("walls.at_rest.height")} value={height} onChange={setHeight} min={0.1} step={0.5} decimalScale={2} w={160} />
        <NumberInput label={t("walls.at_rest.surcharge")} value={surcharge} onChange={setSurcharge} min={0} step={5} decimalScale={2} w={140} />
        <Select
          label={t("walls.at_rest.gwt_case")}
          data={[
            { value: "insitu", label: t("web.soil.gwt.insitu") },
            { value: "design", label: t("web.soil.gwt.design") },
            { value: "seismic", label: t("web.soil.gwt.seismic") },
          ]}
          value={gwtCase}
          onChange={(v) => v && setGwtCase(v as GwtCase)}
          allowDeselect={false}
          w={180}
        />
        <Button onClick={() => void run()} loading={busy} disabled={!valid}>
          {t("walls.at_rest.run")}
        </Button>
      </Group>
      </SectionCard>

      {error !== null && <ErrorAlert error={error} />}

      {result && (
        <Stack gap="md" data-testid="at-rest-result">
          <SectionCard title={t("walls.at_rest.diagram")}>
            <AtRestDiagram result={result} />
          </SectionCard>

          <SectionCard title={t("walls.at_rest.layers")}>
          <Table withTableBorder data-testid="at-rest-layers">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("walls.at_rest.col.layer")}</Table.Th>
                <Table.Th>{t("walls.at_rest.col.range")}</Table.Th>
                <Table.Th>{t("walls.at_rest.col.k0")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.layers.map((layer) => (
                <Table.Tr key={layer.layer_id}>
                  <Table.Td>{layer.layer_id}</Table.Td>
                  <Table.Td>
                    {fmt(layer.top)} – {fmt(layer.bottom)}
                  </Table.Td>
                  <Table.Td>{fmt(layer.K0, 3)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          </SectionCard>

          <SectionCard title={t("walls.at_rest.components")}>
          <Table withTableBorder data-testid="at-rest-components">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("walls.at_rest.col.component")}</Table.Th>
                <Table.Th>{t("walls.at_rest.col.force")}</Table.Th>
                <Table.Th>{t("walls.at_rest.col.arm")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.components.map((c) => (
                <Table.Tr key={c.name}>
                  <Table.Td>{t(`walls.at_rest.component.${c.name}`)}</Table.Td>
                  <Table.Td>{fmt(c.force)}</Table.Td>
                  <Table.Td>{fmt(c.height)}</Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr fw={700}>
                <Table.Td>{t("walls.at_rest.total")}</Table.Td>
                <Table.Td data-testid="at-rest-total-force">{fmt(result.total_force)}</Table.Td>
                <Table.Td data-testid="at-rest-total-height">{fmt(result.total_height)}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          </SectionCard>

          {result.warnings.map((w) => (
            <Text key={w} size="xs" c="orange">
              {w}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
