import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Group, Progress, Select, Stack, Table, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, cancel_job, get_job } from "../../../shared/api/client";
import type { JobState, LiquefactionResultDTO } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { SoundingDetail } from "../components/SoundingDetail";

const POLL_MS = 300;
const TERMINAL = new Set<JobState["status"]>(["done", "failed", "cancelled"]);

function minFs(values: (number | null)[]): number | null {
  const finite = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return finite.length ? Math.min(...finite) : null;
}

export function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jobId = params.get("job");

  const [state, setState] = useState<JobState | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [selectedSounding, setSelectedSounding] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!jobId) return;
    const mine = ++seq.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState(null);
    setGone(false);
    setError(null);
    const tick = async () => {
      try {
        const s = await get_job(jobId);
        if (mine !== seq.current) return;
        setState(s);
        if (!TERMINAL.has(s.status)) timer = setTimeout(tick, POLL_MS);
      } catch (err) {
        if (mine !== seq.current) return;
        if (err instanceof ApiError && err.status === 404) setGone(true);
        else setError(err);
      }
    };
    void tick();
    return () => {
      seq.current += 1;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    try {
      setState(await cancel_job(jobId));
    } catch (err) {
      setError(err);
    }
  }, [jobId]);

  const back = (
    <Button variant="default" onClick={() => navigate("/m/liquefaction")}>
      {t("liquefaction.results.back")}
    </Button>
  );

  if (!jobId) {
    return <EmptyState title={t("liquefaction.results.title")} description={t("liquefaction.results.no_job")} action={back} />;
  }
  if (gone) {
    return (
      <EmptyState title={t("liquefaction.results.title")} description={t("liquefaction.results.unavailable")} action={back} />
    );
  }
  if (error != null) {
    return (
      <Stack gap="md" maw={880}>
        <ErrorAlert error={error} />
        {back}
      </Stack>
    );
  }
  if (!state) return <Text size="sm">{t("web.common.loading")}</Text>;

  if (state.status === "failed") {
    return (
      <Stack gap="md" maw={880}>
        <Title order={2}>{t("liquefaction.results.title")}</Title>
        {state.error ? <ErrorAlert error={new ApiError(400, state.error)} /> : <Alert color="red">{t("liquefaction.results.failed")}</Alert>}
        {back}
      </Stack>
    );
  }
  if (state.status === "cancelled") {
    return <EmptyState title={t("liquefaction.results.title")} description={t("liquefaction.results.cancelled")} action={back} />;
  }
  if (state.status !== "done") {
    return (
      <Stack gap="md" maw={880}>
        <Title order={2}>{t("liquefaction.results.title")}</Title>
        <Progress value={Math.round(state.progress * 100)} />
        <Text size="sm">{state.message_key ? t(state.message_key) : t("liquefaction.results.running")}</Text>
        <Group>
          <Button variant="default" onClick={cancel}>
            {t("liquefaction.results.cancel")}
          </Button>
        </Group>
      </Stack>
    );
  }

  const result = state.result as LiquefactionResultDTO | null;
  const ids = result ? Object.keys(result.per_sounding) : [];
  const errors = result ? Object.entries(result.errors) : [];
  const activeSounding = selectedSounding && ids.includes(selectedSounding) ? selectedSounding : ids[0];
  if (!result || (ids.length === 0 && errors.length === 0)) {
    return <EmptyState title={t("liquefaction.results.title")} description={t("liquefaction.results.empty")} action={back} />;
  }

  return (
    <Stack gap="md" maw={880}>
      <Title order={2}>{t("liquefaction.results.title")}</Title>
      {ids.some((id) => result.per_sounding[id].warnings.includes("mock_result_not_a_calculation")) && (
        <Alert color="yellow">{t("liquefaction.results.mock_note")}</Alert>
      )}
      {ids.length > 0 && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("liquefaction.results.sounding")}</Table.Th>
              <Table.Th>{t("liquefaction.results.min_fs")}</Table.Th>
              <Table.Th>{t("liquefaction.results.liquefiable_count")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ids.map((id) => {
              const s = result.per_sounding[id];
              const fs = minFs(s.FS);
              return (
                <Table.Tr key={id}>
                  <Table.Td>{id}</Table.Td>
                  <Table.Td>{fs === null ? "—" : fs.toFixed(2)}</Table.Td>
                  <Table.Td>{s.status.filter((x) => x === "liquefiable").length}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
      {ids.length > 1 && (
        <Select label={t("liquefaction.results.select_sounding")} data={ids}
          value={activeSounding} onChange={setSelectedSounding} allowDeselect={false} />
      )}
      {activeSounding && <SoundingDetail id={activeSounding} sounding={result.per_sounding[activeSounding]} />}
      {errors.length > 0 && (
        <Alert color="red" variant="light" title={t("liquefaction.results.errors_title")}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.map(([id, msg]) => (
              <li key={id}>
                {id}: {msg}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {back}
    </Stack>
  );
}
