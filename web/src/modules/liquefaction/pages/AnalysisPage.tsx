import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, Anchor, Badge, Box, Button, Group, NumberInput, Radio, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconCircleCheck, IconCircleDashed, IconInfoCircle } from "@tabler/icons-react";
import { run_liquefaction, type LiquefactionSettingsDTO } from "../api";
import { ApiError, get_project } from "../../../shared/api/client";
import { list_project_profiles } from "../../../shared/api/core";
import type { ProfileSummary } from "../../../shared/api/types";
import { ActionBar } from "../../../shared/components/ActionBar";
import { CollapsibleSection } from "../../../shared/components/CollapsibleSection";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { FieldNote } from "../../../shared/components/FieldNote";
import { PageHeader } from "../../../shared/components/PageHeader";
import { SectionCard } from "../../../shared/components/SectionCard";

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

type FieldState = "ok" | "missing" | "invalid";

interface Checks {
  profile: FieldState;
  method: FieldState;
  amax: FieldState;
  mw: FieldState;
  fs: FieldState;
  cfc: FieldState;
  ic: FieldState;
  fc: FieldState;
  gwt: FieldState;
}

/** Message shown under a field whose value is present but not acceptable. */
type Messages = Partial<Record<"amax" | "mw" | "fs" | "fc" | "gwt", string>>;

/** Mirrors geotek/engine/liquefaction/analysis.py _check_inputs, plus finite-number checks. */
function validate(f: Form, hasProfile: boolean, t: Translate): { checks: Checks; messages: Messages } {
  const messages: Messages = {};
  const required = (v: Field): boolean => Number.isFinite(num(v));
  const ranged = (key: keyof Messages, v: Field, inRange: boolean, message: string): FieldState => {
    if (!required(v)) return "missing";
    if (!inRange) {
      messages[key] = message;
      return "invalid";
    }
    return "ok";
  };
  const optional = (key: "fc" | "gwt", v: Field): FieldState => {
    if (v === "" || Number.isFinite(num(v))) return "ok";
    messages[key] = t("liquefaction.error.number_invalid");
    return "invalid";
  };
  const checks: Checks = {
    profile: hasProfile ? "ok" : "missing",
    method: f.method ? "ok" : "missing",
    amax: ranged("amax", f.amax, num(f.amax) > 0 && num(f.amax) <= 2.0, t("liquefaction.error.amax_range")),
    mw: ranged("mw", f.mw, num(f.mw) >= 4.0 && num(f.mw) <= 9.5, t("liquefaction.error.mw_range")),
    fs: ranged("fs", f.fs, num(f.fs) >= 1.0, t("liquefaction.error.target_fs_min")),
    cfc: required(f.cfc) ? "ok" : "missing",
    ic: required(f.ic) ? "ok" : "missing",
    fc: optional("fc", f.fc),
    gwt: optional("gwt", f.gwt),
  };
  return { checks, messages };
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
  const { checks, messages } = validate({ method, amax, mw, fs, cfc, ic, fc, gwt }, hasProfiles && !!profileId, t);
  const missingCount = Object.values(checks).filter((state) => state !== "ok").length;
  const canRun = missingCount === 0 && !submitting;
  const selectedProfile = profiles.find((p) => p.id === profileId) ?? null;

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
      const ref = await run_liquefaction(settings);
      navigate(`/m/liquefaction/results?job=${encodeURIComponent(ref.job_id)}`);
    } catch (err) {
      setRunError(err);
      setSubmitting(false);
    }
  }

  const noSource = runError instanceof ApiError && runError.code === "no_soil_source";
  const profileMissing = runError instanceof ApiError && runError.status === 404 && runError.code === "not_found";

  const fromProject = (value: Field, site: number | null) => site !== null && value === site;
  const required = (state: FieldState) => state === "missing" && <FieldNote kind="required">{t("liquefaction.required")}</FieldNote>;
  const problem = (key: keyof Messages) => messages[key] && <FieldNote kind="error">{messages[key]}</FieldNote>;
  const projectNote = (
    <FieldNote kind="help">
      {t("liquefaction.site_note")} ·{" "}
      <Anchor component={Link} to="/launcher" size="xs">{t("liquefaction.site_change")}</Anchor>
    </FieldNote>
  );
  const checklist: Array<{ id: string; label: string; state: FieldState }> = [
    { id: "liq-profile", label: t("liquefaction.check.profile"), state: checks.profile },
    { id: "liq-method", label: t("liquefaction.check.method"), state: checks.method },
    { id: "liq-amax", label: t("liquefaction.check.amax"), state: checks.amax },
    { id: "liq-mw", label: t("liquefaction.check.mw"), state: checks.mw },
    { id: "liq-fs", label: t("liquefaction.check.target_fs"), state: checks.fs },
    { id: "liq-cfc", label: t("liquefaction.check.c_fc"), state: checks.cfc },
    { id: "liq-ic", label: t("liquefaction.check.ic_cutoff"), state: checks.ic },
  ];

  return (
    <Stack gap="md" maw={1120}>
      <PageHeader title={t("liquefaction.analysis.title")} lead={t("liquefaction.analysis.subtitle")} />

      <Box style={{ display: "grid", gap: "var(--mantine-spacing-md)", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
        <Stack gap="md" style={{ gridColumn: "span 2", minWidth: 0 }}>
          <SectionCard step={1} title={t("liquefaction.section.soil")}>
            {hasProfiles ? (
              <Stack gap="xs">
                <Select
                  id="liq-profile"
                  label={t("liquefaction.profile.label")}
                  value={profileId}
                  onChange={setProfileId}
                  allowDeselect={false}
                  data={profiles.map((p) => ({
                    value: p.id,
                    label: p.id === activeId ? `${p.name} (${t("liquefaction.profile.active")})` : p.name,
                  }))}
                />
                {selectedProfile && (
                  <Group gap="xs" align="center">
                    <Text size="sm" c="dimmed">{t("liquefaction.profile.sources")}</Text>
                    {selectedProfile.source_ids.length === 0
                      ? <Text size="sm" c="dimmed">{t("web.common.none")}</Text>
                      : selectedProfile.source_ids.map((id) => <Badge key={id} variant="light" color="gray" tt="none">{id}</Badge>)}
                    <Text size="sm" c="dimmed">· {t("web.soil.layer_count", { count: selectedProfile.layer_count })}</Text>
                  </Group>
                )}
              </Stack>
            ) : (
              <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>
                {t("liquefaction.profile.none")}
              </Alert>
            )}
          </SectionCard>

          <SectionCard step={2} title={t("liquefaction.section.earthquake")}>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <div>
                <NumberInput id="liq-amax" label={t("liquefaction.field.amax_g")} value={amax} onChange={setAmax} decimalScale={4} />
                {fromProject(amax, sitePga) && projectNote}
                {required(checks.amax)}
                {problem("amax")}
              </div>
              <div>
                <NumberInput id="liq-mw" label={t("liquefaction.field.mw")} value={mw} onChange={setMw} decimalScale={3} />
                {fromProject(mw, siteMw) && projectNote}
                {required(checks.mw)}
                {problem("mw")}
              </div>
              <div>
                <NumberInput label={t("liquefaction.field.gwt_seismic")} value={gwt} onChange={setGwt} decimalScale={2} />
                <FieldNote kind="help">{t("liquefaction.help.gwt_seismic")}</FieldNote>
                {problem("gwt")}
              </div>
            </SimpleGrid>
          </SectionCard>

          <SectionCard step={3} title={t("liquefaction.section.method")}>
            <Stack gap="md">
              <div>
                <Radio.Group id="liq-method" label={t("liquefaction.field.method")} value={method} onChange={(v) => setMethod(v as Method)}>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} mt={6}>
                    {(["bi2014", "youd2001"] as const).map((value) => (
                      <Radio.Card key={value} value={value} radius="md" p="sm">
                        <Group wrap="nowrap" align="flex-start" gap="sm">
                          <Radio.Indicator />
                          <div>
                            <Text fw={500} size="sm">{t(`liquefaction.method.${value}`)}</Text>
                            <Text size="xs" c="dimmed">{t("liquefaction.method.tests")}</Text>
                          </div>
                        </Group>
                      </Radio.Card>
                    ))}
                  </SimpleGrid>
                </Radio.Group>
                {required(checks.method)}
              </div>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <div>
                  <NumberInput id="liq-fs" label={t("liquefaction.field.target_fs")} value={fs} onChange={setFs} decimalScale={3} />
                  <FieldNote kind="help">{t("liquefaction.help.target_fs")}</FieldNote>
                  {required(checks.fs)}
                  {problem("fs")}
                </div>
                <div>
                  <NumberInput id="liq-cfc" label={t("liquefaction.field.c_fc")} value={cfc} onChange={setCfc} decimalScale={4} />
                  <FieldNote kind="help">{t("liquefaction.help.c_fc")}</FieldNote>
                  {required(checks.cfc)}
                </div>
                <div>
                  <NumberInput id="liq-ic" label={t("liquefaction.field.ic_cutoff")} value={ic} onChange={setIc} decimalScale={3} />
                  <FieldNote kind="help">{t("liquefaction.help.ic_cutoff")}</FieldNote>
                  {required(checks.ic)}
                </div>
              </SimpleGrid>
              <CollapsibleSection label={t("liquefaction.advanced")}>
                <NumberInput label={t("liquefaction.field.default_fc")} value={fc} onChange={setFc} decimalScale={2} maw={320} />
                <FieldNote kind="help">{t("liquefaction.help.default_fc")}</FieldNote>
                {problem("fc")}
              </CollapsibleSection>
            </Stack>
          </SectionCard>
        </Stack>

        <SectionCard title={t("liquefaction.check.title")}>
          <Stack gap="xs" component="ul" m={0} p={0} style={{ listStyle: "none" }}>
            {checklist.map((item) => (
              <Group key={item.id} component="li" justify="space-between" wrap="nowrap" gap="xs">
                <Group gap={8} wrap="nowrap">
                  {item.state === "ok"
                    ? <IconCircleCheck size={18} color="var(--gt-ok-dot)" aria-hidden="true" />
                    : <IconCircleDashed size={18} color="var(--gt-warn-dot)" aria-hidden="true" />}
                  <Text size="sm" c={item.state === "ok" ? "dimmed" : undefined}>{item.label}</Text>
                </Group>
                {item.state !== "ok" && (
                  <Button size="compact-xs" variant="subtle" onClick={() => focusField(item.id)}>
                    {t("liquefaction.check.go")}
                  </Button>
                )}
              </Group>
            ))}
          </Stack>
        </SectionCard>
      </Box>

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

      <ActionBar
        summary={missingCount > 0 ? t("liquefaction.bar.missing", { count: missingCount }) : undefined}
        text={t(missingCount > 0 ? "liquefaction.bar.hint_missing" : "liquefaction.bar.hint_ready")}
      >
        <Button disabled={!canRun} loading={submitting} onClick={handleRun}>
          {t("liquefaction.run")}
        </Button>
      </ActionBar>
    </Stack>
  );
}

/** Moves keyboard focus to the field (or the first control inside a group) with this id. */
function focusField(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = el.matches("input, button, textarea") ? el : el.querySelector<HTMLElement>("input, button");
  (target ?? el).focus();
  el.scrollIntoView?.({ block: "center", behavior: "smooth" });
}
