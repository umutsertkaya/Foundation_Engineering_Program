import { Group, Switch, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { GroundwaterCondition } from "../api/types";
import { CommitNumberInput } from "./CommitInputs";
import { GwtMarker } from "./GwtMarker";
import type { GwtCase } from "./zones";

function CaseLabel({ kind, text }: { kind: GwtCase; text: string }) {
  return (
    <Group gap={4} wrap="nowrap" component="span">
      <svg width={12} height={14} viewBox="0 0 12 14" aria-hidden style={{ display: "block" }}>
        <GwtMarker x={6} y={8} kind={kind} size={8} />
      </svg>
      <Text span size="xs" fw={500}>
        {text}
      </Text>
    </Group>
  );
}

export interface GwtEditorProps {
  value: GroundwaterCondition;
  onChange: (next: GroundwaterCondition) => void;
  error?: string | null;
  disabled?: boolean;
  /** Unit hint appended to labels, e.g. "z from retained surface". */
  hint?: string;
}

/** In-situ / design / seismic groundwater depths; design and seismic may be empty (= in situ). */
export function GwtEditor({ value, onChange, error, disabled, hint }: GwtEditorProps) {
  const { t } = useTranslation();
  const insitu = value.depth_insitu;
  const placeholder = Number.isFinite(insitu) ? `= ${insitu}` : undefined;
  return (
    <Group gap="xs" align="flex-end" wrap="wrap">
      <div>
        <CaseLabel kind="insitu" text={t("web.soil.gwt.insitu")} />
        <CommitNumberInput
          value={value.depth_insitu}
          width={84}
          readOnly={disabled}
          ariaLabel={t("ui.profile.gwt_insitu")}
          error={error}
          onCommit={(v) => onChange({ ...value, depth_insitu: v ?? Number.NaN })}
        />
      </div>
      <div>
        <CaseLabel kind="design" text={t("web.soil.gwt.design")} />
        <CommitNumberInput
          value={value.depth_design}
          width={84}
          readOnly={disabled}
          placeholder={placeholder}
          ariaLabel={t("ui.profile.gwt_design")}
          error={error}
          onCommit={(v) => onChange({ ...value, depth_design: v })}
        />
      </div>
      <div>
        <CaseLabel kind="seismic" text={t("web.soil.gwt.seismic")} />
        <CommitNumberInput
          value={value.depth_seismic}
          width={84}
          readOnly={disabled}
          placeholder={placeholder}
          ariaLabel={t("ui.profile.gwt_seismic")}
          error={error}
          onCommit={(v) => onChange({ ...value, depth_seismic: v })}
        />
      </div>
      <Text size="xs" c="dimmed" pb={6}>
        {hint ?? t("web.soil.gwt.unit_hint")}
      </Text>
    </Group>
  );
}

export interface GwtOverrideEditorProps {
  label: string;
  value: GroundwaterCondition | null | undefined;
  inherited: GroundwaterCondition;
  onChange: (next: GroundwaterCondition | null) => void;
  error?: string | null;
}

/** Structure-side water table: "same as profile" (null) or an own GroundwaterCondition. */
export function GwtOverrideEditor({ label, value, inherited, onChange, error }: GwtOverrideEditorProps) {
  const { t } = useTranslation();
  const same = !value;
  return (
    <div>
      <Group justify="space-between" gap="xs" mb={4} wrap="wrap">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        <Switch
          size="xs"
          label={t("web.wizard.gwt_same_as_profile")}
          checked={same}
          onChange={(e) => onChange(e.currentTarget.checked ? null : { ...inherited })}
        />
      </Group>
      <GwtEditor
        value={value ?? inherited}
        disabled={same}
        error={same ? null : error}
        onChange={(next) => onChange(next)}
        hint={t("web.wizard.gwt_frame_hint")}
      />
    </div>
  );
}
