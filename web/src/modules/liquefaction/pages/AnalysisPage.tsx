import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, Button, Group, NumberInput, Select, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { run_liquefaction, type LiquefactionSettingsDTO } from "../api";
import { ApiError, get_project } from "../../../shared/api/client";
import { list_project_profiles } from "../../../shared/api/core";
import type { ProfileSummary } from "../../../shared/api/types";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";

type Method = LiquefactionSettingsDTO["method"];
type Field = number | string;
type Translate = (key: string, opts?: Record<string, unknown>) => string;

interface Form {
  method: Method | null;
  amax: Field;
  mw: Field;
  fs: Field;
  cfc: Field;
  ic: Field;
  fc: Field;
  gwt: Field;
}

function num(v: Field): number {
  return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
}

function optNum(v: Field): number | null {
  return v === "" ? null : num(v);
}

/** Mirrors geotek/engine/liquefaction/analysis.py _check_inputs, plus finite-number checks. */
function validate(f: Form, t: Translate): string[] {
  const issues: string[] = [];
  if (!f.method) issues.push(t("liquefaction.error.method_required"));
  const required = (label: string, v: Field) => {
    const ok = Number.isFinite(num(v));
    if (!ok) issues.push(t("liquefaction.error.number_required", { field: label }));
    return ok;
  };
  if (required(t("liquefaction.field.amax_g"), f.amax) && !(num(f.amax) > 0 && num(f.amax) <= 2.0)) {
    issues.push(t("liquefaction.error.amax_range"));
  }
  if (required(t("liquefaction.field.mw"), f.mw) && !(num(f.mw) >= 4.0 && num(f.mw) <= 9.5)) {
    issues.push(t("liquefaction.error.mw_range"));
  }
  if (required(t("liquefaction.field.target_fs"), f.fs) && !(num(f.fs) >= 1.0)) {
    issues.push(t("liquefaction.error.target_fs_min"));
  }
  required(t("liquefaction.field.c_fc"), f.cfc);
  required(t("liquefaction.field.ic_cutoff"), f.ic);
  const optional: Array<[string, Field]> = [
    [t("liquefaction.field.default_fc"), f.fc],
    [t("liquefaction.field.gwt_seismic"), f.gwt],
  ];
  for (const [label, v] of optional) {
    if (v !== "" && !Number.isFinite(num(v))) issues.push(t("liquefaction.error.number_invalid", { field: label }));
  }
  return issues;
}

export function AnalysisPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Engineering coefficients start empty; only amax_g and mw may come from project site data.
  const [method, setMethod] = useState<Method | null>(null);
  const [amax, setAmax] = useState<Field>("");
  const [mw, setMw] = useState<Field>("");
  const [fs, setFs] = useState<Field>("");
  const [cfc, setCfc] = useState<Field>("");
  const [ic, setIc] = useState<Field>("");
  const [fc, setFc] = useState<Field>("");
  const [gwt, setGwt] = useState<Field>("");
  const [sitePga, setSitePga] = useState<number | null>(null);
  const [siteMw, setSiteMw] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError] = useState<unknown>(null);
  const loadSeq = useRef(0);

  const load = useCallback(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setLoadError(null);
    Promise.all([list_project_profiles(), get_project()])
      .then(([profs, project]) => {
        if (seq !== loadSeq.current) return;
        const active = project.active_profile_id ?? null;
        setProfiles(profs);
        setActiveId(active);
        setProfileId((cur) =>
          cur && profs.some((p) => p.id === cur) ? cur : profs.find((p) => p.id === active)?.id ?? profs[0]?.id ?? null,
        );
        const pga = project.site?.pga_g;
        const siteMwValue = project.site?.mw;
        const pgaOk = typeof pga === "number" && Number.isFinite(pga);
        const mwOk = typeof siteMwValue === "number" && Number.isFinite(siteMwValue);
        setSitePga(pgaOk ? pga : null);
        setSiteMw(mwOk ? siteMwValue : null);
        if (pgaOk) setAmax((cur) => (cur === "" ? pga : cur));
        if (mwOk) setMw((cur) => (cur === "" ? siteMwValue : cur));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (seq !== loadSeq.current) return;
        setLoadError(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
    return () => {
      loadSeq.current += 1;
    };
  }, [load]);

  if (loading) return <Text size="sm">{t("web.common.loading")}</Text>;

  if (loadError != null) {
    return (
      <Stack gap="md" maw={880}>
        <ErrorAlert error={loadError} onRetry={load} />
      </Stack>
    );
  }

  const hasProfiles = profiles.length > 0;
  const issues = validate({ method, amax, mw, fs, cfc, ic, fc, gwt }, t);
  const canRun = hasProfiles && !!profileId && issues.length === 0 && !submitting;

  async function handleRun() {
    if (!canRun || !method) return;
    setSubmitting(true);
    setRunError(null);
    const settings: LiquefactionSettingsDTO = {
      profile_id: profileId,
      method,
      amax_g: num(amax),
      mw: num(mw),
      target_fs: num(fs),
      gwt_seismic: optNum(gwt),
      default_fc: optNum(fc),
      c_fc: num(cfc),
      ic_cutoff: num(ic),
    };
    try {
      await run_liquefaction(settings);
      navigate("/m/liquefaction/results");
    } catch (err) {
      setRunError(err);
      setSubmitting(false);
    }
  }

  const noSource = runError instanceof ApiError && runError.code === "no_soil_source";
  const profileMissing = runError instanceof ApiError && runError.status === 404 && runError.code === "not_found";

  return (
    <Stack gap="lg" maw={880}>
      <Stack gap={4}>
        <Title order={2}>{t("liquefaction.analysis.title")}</Title>
        <Text c="dimmed">{t("liquefaction.analysis.subtitle")}</Text>
      </Stack>

      {hasProfiles ? (
        <Select
          label={t("liquefaction.profile.label")}
          value={profileId}
          onChange={setProfileId}
          allowDeselect={false}
          data={profiles.map((p) => ({
            value: p.id,
            label: p.id === activeId ? `${p.name} (${t("liquefaction.profile.active")})` : p.name,
          }))}
        />
      ) : (
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>
          {t("liquefaction.profile.none")}
        </Alert>
      )}

      <Select
        label={t("liquefaction.field.method")}
        placeholder={t("liquefaction.field.method_placeholder")}
        value={method}
        onChange={(v) => setMethod(v as Method | null)}
        allowDeselect={false}
        data={[
          { value: "bi2014", label: t("liquefaction.method.bi2014") },
          { value: "youd2001", label: t("liquefaction.method.youd2001") },
        ]}
      />

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <NumberInput
          label={t("liquefaction.field.amax_g")}
          value={amax}
          onChange={setAmax}
          decimalScale={4}
          description={sitePga !== null && amax === sitePga ? t("liquefaction.site_note") : undefined}
        />
        <NumberInput
          label={t("liquefaction.field.mw")}
          value={mw}
          onChange={setMw}
          decimalScale={3}
          description={siteMw !== null && mw === siteMw ? t("liquefaction.site_note") : undefined}
        />
        <NumberInput label={t("liquefaction.field.target_fs")} value={fs} onChange={setFs} decimalScale={3} />
        <NumberInput label={t("liquefaction.field.c_fc")} value={cfc} onChange={setCfc} decimalScale={4} />
        <NumberInput label={t("liquefaction.field.ic_cutoff")} value={ic} onChange={setIc} decimalScale={3} />
        <NumberInput
          label={t("liquefaction.field.default_fc")}
          description={t("liquefaction.help.default_fc")}
          value={fc}
          onChange={setFc}
          decimalScale={2}
        />
        <NumberInput
          label={t("liquefaction.field.gwt_seismic")}
          description={t("liquefaction.help.gwt_seismic")}
          value={gwt}
          onChange={setGwt}
          decimalScale={2}
        />
      </SimpleGrid>

      {issues.length > 0 && (
        <Alert color="yellow" variant="light" title={t("liquefaction.error.issues_title")}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {issues.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </Alert>
      )}

      {runError != null &&
        (noSource ? (
          <Alert color="red" variant="light">
            {t("liquefaction.error.no_soil_source")}
          </Alert>
        ) : profileMissing ? (
          <Alert color="red" variant="light">
            <Group justify="space-between" align="center">
              <Text size="sm">{t("liquefaction.error.profile_missing")}</Text>
              <Button
                size="compact-xs"
                variant="light"
                color="red"
                onClick={() => {
                  setRunError(null);
                  load();
                }}
              >
                {t("web.common.retry")}
              </Button>
            </Group>
          </Alert>
        ) : (
          <ErrorAlert error={runError} />
        ))}

      <Group justify="flex-end">
        <Button disabled={!canRun} loading={submitting} onClick={handleRun}>
          {t("liquefaction.run")}
        </Button>
      </Group>
    </Stack>
  );
}
