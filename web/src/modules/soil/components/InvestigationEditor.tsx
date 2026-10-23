import { useState } from "react";
import { Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { Borehole, BoreholeLayer, CPTSounding, LabRecord, SPTRecord } from "../../../shared/api/types";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { USCS_SYMBOLS } from "../../../shared/soil/uscs";
import { create_borehole, update_borehole, update_cpt } from "../api";
import { RecordTable, type RecordColumn } from "./RecordTable";

export type EditTarget = { kind: "borehole"; value: Borehole; isNew: boolean } | { kind: "cpt"; value: CPTSounding };

interface Props {
  target: EditTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

const LAB_FIELDS = ["w", "LL", "PL", "FC", "gravel", "D10", "D30", "D60", "gamma", "c_eff", "phi_eff", "su"] as const;

function num(v: string | number): number | null {
  return typeof v === "number" ? v : null;
}

export function InvestigationEditor({ target, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  return (
    <Modal opened={target !== null} onClose={onClose} title={t("web.site.edit_title")} size="xl">
      {target && (
        // Remounts per target so the draft always starts from the stored record.
        <EditorBody key={`${target.kind}:${target.value.id}`} target={target} onClose={onClose} onSaved={onSaved} />
      )}
    </Modal>
  );
}

function EditorBody({ target, onClose, onSaved }: { target: EditTarget } & Pick<Props, "onClose" | "onSaved">) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Borehole | CPTSounding>(structuredClone(target.value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [idMissing, setIdMissing] = useState(false);

  const patch = (changes: Partial<Borehole> & Partial<CPTSounding>) => setDraft({ ...draft, ...changes } as Borehole | CPTSounding);

  const save = async () => {
    if (!draft.id.trim()) {
      setIdMissing(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (target.kind === "cpt") {
        await update_cpt(draft as CPTSounding);
      } else if (target.isNew) {
        await create_borehole({ ...(draft as Borehole), id: draft.id.trim() });
      } else {
        await update_borehole(draft as Borehole);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const general = (
    <Stack gap="xs">
      <TextInput
        label={t("web.site.record_id")}
        value={draft.id}
        disabled={!(target.kind === "borehole" && target.isNew)}
        error={idMissing ? t("web.site.import_id_required") : null}
        onChange={(e) => patch({ id: e.currentTarget.value })}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <NumberInput
          label={t("web.site.gwt_depth")}
          description={t("web.site.gwt_hint")}
          min={0}
          decimalScale={2}
          value={draft.gwt_depth ?? ""}
          onChange={(v) => patch({ gwt_depth: num(v) })}
        />
        <NumberInput
          label={t("web.site.elevation")}
          decimalScale={2}
          value={draft.elevation ?? ""}
          onChange={(v) => patch({ elevation: num(v) })}
        />
        {target.kind === "cpt" ? (
          <>
            <NumberInput
              label={t("ui.import.area_ratio")}
              min={0.01}
              max={1}
              decimalScale={3}
              value={(draft as CPTSounding).area_ratio ?? 0.8}
              onChange={(v) => patch({ area_ratio: num(v) ?? 0.8 })}
            />
            <NumberInput
              label={t("web.site.predrill")}
              min={0}
              decimalScale={2}
              value={(draft as CPTSounding).predrill_depth ?? 0}
              onChange={(v) => patch({ predrill_depth: num(v) ?? 0 })}
            />
          </>
        ) : (
          <>
            <NumberInput
              label={t("web.site.energy_ratio")}
              description={t("web.site.energy_ratio_hint")}
              min={1}
              max={100}
              decimalScale={1}
              placeholder="60"
              value={(draft as Borehole).energy_ratio ?? ""}
              onChange={(v) => patch({ energy_ratio: num(v) })}
            />
            <NumberInput
              label={t("web.site.diameter")}
              min={1}
              decimalScale={0}
              value={(draft as Borehole).borehole_diameter_mm ?? 100}
              onChange={(v) => patch({ borehole_diameter_mm: num(v) ?? 100 })}
            />
            <Select
              label={t("web.site.sampler")}
              allowDeselect={false}
              data={[
                { value: "standard", label: t("web.site.sampler_standard") },
                { value: "no_liner", label: t("web.site.sampler_no_liner") },
              ]}
              value={(draft as Borehole).sampler ?? "standard"}
              onChange={(v) => patch({ sampler: v === "no_liner" ? "no_liner" : "standard" })}
            />
          </>
        )}
      </SimpleGrid>
    </Stack>
  );

  const sptColumns: RecordColumn[] = [
    { key: "depth", label: t("web.site.col_depth"), kind: "number" },
    { key: "n_field", label: "N", kind: "number" },
    { key: "refusal", label: t("web.site.col_refusal"), kind: "bool" },
    { key: "notes", label: t("web.site.col_notes"), kind: "text", width: 160 },
  ];
  const logColumns: RecordColumn[] = [
    { key: "top", label: t("ui.layer.top"), kind: "number" },
    { key: "bottom", label: t("ui.layer.bottom"), kind: "number" },
    { key: "uscs", label: t("ui.layer.uscs"), kind: "select", options: USCS_SYMBOLS, width: 110 },
    { key: "description", label: t("ui.layer.description"), kind: "text", width: 200 },
  ];
  const labColumns: RecordColumn[] = [
    { key: "depth", label: t("web.site.col_depth"), kind: "number" },
    ...LAB_FIELDS.map((key) => ({ key, label: t(`web.site.lab.${key}`), kind: "number" as const })),
  ];

  const borehole = draft as Borehole;
  return (
    <Stack gap="sm">
      {error != null && <ErrorAlert error={error} />}
      {target.kind === "cpt" ? (
        general
      ) : (
        <Tabs defaultValue="general">
          <Tabs.List>
            <Tabs.Tab value="general">{t("web.site.tab_general")}</Tabs.Tab>
            <Tabs.Tab value="spt">{t("web.site.tab_spt")}</Tabs.Tab>
            <Tabs.Tab value="log">{t("web.site.tab_log")}</Tabs.Tab>
            <Tabs.Tab value="lab">{t("web.site.tab_lab")}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="general" pt="sm">{general}</Tabs.Panel>
          <Tabs.Panel value="spt" pt="sm">
            <Text size="xs" c="dimmed" mb="xs">{t("web.site.spt_hint")}</Text>
            <RecordTable<SPTRecord>
              columns={sptColumns}
              rows={borehole.spt ?? []}
              onChange={(spt) => patch({ spt: spt.map((r) => ({ ...r, depth: r.depth ?? 0, n_field: r.n_field ?? 0 })) })}
              blank={() => ({ depth: 0, n_field: 0, refusal: false, notes: "" })}
              addLabel={t("web.site.add_row")}
            />
          </Tabs.Panel>
          <Tabs.Panel value="log" pt="sm">
            <Text size="xs" c="dimmed" mb="xs">{t("web.site.log_hint")}</Text>
            <RecordTable<BoreholeLayer>
              columns={logColumns}
              rows={borehole.log ?? []}
              onChange={(log) => patch({ log })}
              blank={() => ({ top: 0, bottom: 1, uscs: null, description: "" })}
              addLabel={t("web.site.add_row")}
            />
          </Tabs.Panel>
          <Tabs.Panel value="lab" pt="sm">
            <Text size="xs" c="dimmed" mb="xs">{t("web.site.lab_hint")}</Text>
            <RecordTable<LabRecord>
              columns={labColumns}
              rows={borehole.lab ?? []}
              onChange={(lab) => patch({ lab })}
              blank={() => ({ depth: 0 })}
              addLabel={t("web.site.add_row")}
            />
          </Tabs.Panel>
        </Tabs>
      )}
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onClose}>{t("start.new.cancel")}</Button>
        <Button loading={busy} onClick={() => void save()}>{t("web.site.save")}</Button>
      </Group>
    </Stack>
  );
}
