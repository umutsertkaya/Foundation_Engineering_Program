import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFileImport, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../../shared/api/client";
import { delete_borehole, delete_cpt, import_cpt, import_spt, list_investigations } from "../api";
import type { InvestigationsDTO } from "../types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { InvestigationEditor, type EditTarget } from "../components/InvestigationEditor";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";

export function SiteDataPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InvestigationsDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const loadInvestigations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await list_investigations();
      setData(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvestigations();
  }, [loadInvestigations]);

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [importKind, setImportKind] = useState<"cpt" | "spt" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [recordId, setRecordId] = useState("");
  const [qcUnit, setQcUnit] = useState<"MPa" | "kPa">("MPa");
  const [delimiter, setDelimiter] = useState(";");
  const [decimal, setDecimal] = useState(",");
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<unknown>(null);
  const [fileMissing, setFileMissing] = useState(false);
  const [idMissing, setIdMissing] = useState(false);

  const downloadTemplate = () => {
    const text = importKind === "cpt"
      ? `depth [m]${delimiter}qc [${qcUnit}]${delimiter}fs [kPa]${delimiter}u2 [kPa]\n1${delimiter}${decimal === "," ? "2,5" : "2.5"}${delimiter}${decimal === "," ? "40,0" : "40.0"}${delimiter}0\n`
      : "depth [m],N\n1.5,8\n3.0,12\n4.5,50/12\n";
    const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = importKind === "cpt" ? "cpt-sablon.csv" : "spt-sablon.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const openImport = (kind: "cpt" | "spt") => {
    setImportKind(kind);
    setFile(null);
    setRecordId("");
    setImportError(null);
    setFileMissing(false);
    setIdMissing(false);
  };

  const submitImport = async () => {
    const id = recordId.trim();
    setFileMissing(file === null);
    setIdMissing(id === "");
    if (!file || !id || !importKind) return;
    setBusy(true);
    setImportError(null);
    try {
      if (importKind === "cpt") {
        await import_cpt({ file, sounding_id: id, qc_unit: qcUnit, delimiter, decimal });
      } else {
        await import_spt(file, id);
      }
      setImportKind(null);
      notifications.show({ message: t("web.site.import_done", { id }), color: "green" });
      await loadInvestigations();
    } catch (err) {
      setImportError(err);
    } finally {
      setBusy(false);
    }
  };

  const removeRecord = async (kind: "cpt" | "spt", id: string) => {
    if (!window.confirm(t("web.site.delete_confirm", { id }))) return;
    try {
      await (kind === "cpt" ? delete_cpt(id) : delete_borehole(id));
      await loadInvestigations();
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    }
  };

  if (loading && !data) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  const cpts = data?.cpts ?? [];
  const boreholes = data?.boreholes ?? [];
  const isEmpty = cpts.length === 0 && boreholes.length === 0;

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>{t("web.site.title")}</Title>
        <Text size="sm" c="dimmed">
          {t("web.site.subtitle")}
        </Text>
      </div>

      <Group gap="xs">
        <Button leftSection={<IconFileImport size={16} />} onClick={() => openImport("cpt")}>
          {t("web.site.import_cpt")}
        </Button>
        <Button variant="light" leftSection={<IconFileImport size={16} />} onClick={() => openImport("spt")}>
          {t("web.site.import_spt")}
        </Button>
        <Button
          variant="default"
          leftSection={<IconPlus size={16} />}
          onClick={() => setEditTarget({ kind: "borehole", isNew: true, value: { id: "", energy_ratio: 60, borehole_diameter_mm: 100, sampler: "standard", spt: [], lab: [], log: [] } })}
        >
          {t("web.site.new_borehole")}
        </Button>
      </Group>

      <InvestigationEditor
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => void loadInvestigations()}
      />

      <Modal
        opened={importKind !== null}
        onClose={() => setImportKind(null)}
        title={importKind === "cpt" ? t("web.site.import_cpt") : t("web.site.import_spt")}
        size="md"
      >
        <Stack gap="sm">
          {importError != null && <ErrorAlert error={importError} />}
          <Text size="xs" c="dimmed">
            {importKind === "cpt" ? t("web.site.import_cpt_hint") : t("web.site.import_spt_hint")}
          </Text>
          <Button variant="subtle" size="compact-xs" onClick={downloadTemplate} style={{ alignSelf: "flex-start" }}>
            {t("web.site.template")}
          </Button>
          <FileInput
            label={t("web.site.import_file")}
            placeholder={t("web.site.import_file_placeholder")}
            accept=".csv,.txt,text/csv,text/plain"
            value={file}
            onChange={(f) => { setFile(f); setFileMissing(false); }}
            error={fileMissing ? t("web.site.import_file_required") : null}
          />
          <TextInput
            label={importKind === "cpt" ? t("web.site.cpt_id") : t("web.site.borehole_id")}
            value={recordId}
            onChange={(e) => { setRecordId(e.currentTarget.value); setIdMissing(false); }}
            error={idMissing ? t("web.site.import_id_required") : null}
          />
          {importKind === "cpt" && (
            <Group grow align="flex-start">
              <Select
                label={t("web.site.qc_unit")}
                data={["MPa", "kPa"]}
                allowDeselect={false}
                value={qcUnit}
                onChange={(v) => setQcUnit(v === "kPa" ? "kPa" : "MPa")}
              />
              <Select
                label={t("web.site.delimiter")}
                data={[
                  { value: ";", label: t("web.site.delim_semicolon") },
                  { value: ",", label: t("web.site.delim_comma") },
                  { value: "\t", label: t("web.site.delim_tab") },
                ]}
                allowDeselect={false}
                value={delimiter}
                onChange={(v) => setDelimiter(v ?? ";")}
              />
              <Select
                label={t("web.site.decimal")}
                data={[
                  { value: ",", label: t("web.site.dec_comma") },
                  { value: ".", label: t("web.site.dec_point") },
                ]}
                allowDeselect={false}
                value={decimal}
                onChange={(v) => setDecimal(v ?? ",")}
              />
            </Group>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setImportKind(null)}>{t("start.new.cancel")}</Button>
            <Button loading={busy} onClick={() => void submitImport()}>{t("web.site.import_submit")}</Button>
          </Group>
        </Stack>
      </Modal>

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}

      {isEmpty ? (
        <EmptyState
          title={t("web.site.empty_title")}
          description={t("web.site.empty_desc")}
        />
      ) : (
        <Stack gap="md">
          {/* CPT Soundings */}
          <Stack gap="xs">
            <Title order={5}>{t("web.site.cpt_section")}</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {cpts.map((cpt) => {
                const maxDepth =
                  cpt.depth.length > 0 ? Math.max(...cpt.depth).toFixed(1) : "0.0";
                return (
                  <Card key={cpt.id} withBorder padding="sm" radius="sm">
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={700} ff="monospace">
                          {cpt.id}
                        </Text>
                        <Group gap={6}>
                          <Badge size="xs" color="blue" variant="light">
                            {t("web.site.points_count", { count: cpt.depth.length })}
                          </Badge>
                          <ActionIcon
                            size="sm" variant="subtle"
                            aria-label={t("web.site.edit", { id: cpt.id })}
                            onClick={() => setEditTarget({ kind: "cpt", value: cpt })}
                          >
                            <IconPencil size={14} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm" color="red" variant="subtle"
                            aria-label={t("web.site.delete", { id: cpt.id })}
                            onClick={() => void removeRecord("cpt", cpt.id)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>
                      <Group gap="md">
                        <Text size="xs" c="dimmed">
                          {t("web.site.max_depth", { depth: maxDepth })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t("term.gwt")}:{" "}
                          {cpt.gwt_depth !== null && cpt.gwt_depth !== undefined
                            ? `${cpt.gwt_depth.toFixed(1)} m`
                            : t("web.common.none")}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t("ui.import.area_ratio")}: {cpt.area_ratio ?? 0.8}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>

          {/* Boreholes & Log Intervals */}
          <Stack gap="xs">
            <Title order={5}>{t("web.site.borehole_section")}</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {boreholes.map((bh) => {
                const sptCount = bh.spt?.length ?? 0;
                const labCount = bh.lab?.length ?? 0;
                const logLayers = bh.log ?? [];
                return (
                  <Card key={bh.id} withBorder padding="sm" radius="sm">
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={700} ff="monospace">
                          {bh.id}
                        </Text>
                        <Group gap={6}>
                          <Badge size="xs" color="teal" variant="light">
                            {t("web.site.spt_count", { count: sptCount })}
                          </Badge>
                          <Badge size="xs" color="grape" variant="light">
                            {t("web.site.lab_count", { count: labCount })}
                          </Badge>
                          <ActionIcon
                            size="sm" variant="subtle"
                            aria-label={t("web.site.edit", { id: bh.id })}
                            onClick={() => setEditTarget({ kind: "borehole", isNew: false, value: bh })}
                          >
                            <IconPencil size={14} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm" color="red" variant="subtle"
                            aria-label={t("web.site.delete", { id: bh.id })}
                            onClick={() => void removeRecord("spt", bh.id)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>

                      <Text size="xs" c="dimmed">
                        {t("term.gwt")}:{" "}
                        {bh.gwt_depth !== null && bh.gwt_depth !== undefined
                          ? `${bh.gwt_depth.toFixed(1)} m`
                          : t("web.common.none")}
                      </Text>

                      {logLayers.length > 0 && (
                        <Stack gap={4}>
                          <Text size="xs" fw={600}>
                            {t("web.site.log_intervals")}
                          </Text>
                          <Table withTableBorder withColumnBorders verticalSpacing={3}>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>{t("ui.layer.top")}</Table.Th>
                                <Table.Th>{t("ui.layer.bottom")}</Table.Th>
                                <Table.Th>{t("ui.layer.uscs")}</Table.Th>
                                <Table.Th>{t("ui.layer.description")}</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {logLayers.map((interval, idx) => (
                                <Table.Tr key={`${bh.id}-log-${idx}`}>
                                  <Table.Td ff="monospace">
                                    {interval.top.toFixed(1)}
                                  </Table.Td>
                                  <Table.Td ff="monospace">
                                    {interval.bottom.toFixed(1)}
                                  </Table.Td>
                                  <Table.Td>
                                    <Badge size="xs" variant="outline">
                                      {interval.uscs ?? t("web.common.none")}
                                    </Badge>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="xs">
                                      {interval.description ?? t("web.common.none")}
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
