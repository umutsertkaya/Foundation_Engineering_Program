import { useState } from "react";
import { Badge, Card, Group, Stack, Table, Text, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { SoilLayer, StructureSoilModel } from "../../../shared/api/types";
import {
  formatPermeability,
  IMPERVIOUS_BELOW_K,
  layerPermeability,
  parsePermeability,
  withPermeability,
} from "../settings";

export interface PermeabilityEditorProps {
  soil: StructureSoilModel;
  onChange: (next: StructureSoilModel) => void;
}

interface RowProps {
  layer: SoilLayer;
  origin: "fill" | "profile";
  onCommit: (k: number | null) => void;
}

function PermeabilityRow({ layer, origin, onCommit }: RowProps) {
  const { t } = useTranslation();
  const stored = layerPermeability(layer);
  const [text, setText] = useState(formatPermeability(stored));
  const [error, setError] = useState(false);

  const commit = () => {
    const parsed = parsePermeability(text);
    if (!parsed.ok) {
      setError(true);
      return;
    }
    setError(false);
    if (parsed.value !== stored) onCommit(parsed.value);
    setText(formatPermeability(parsed.value));
  };

  return (
    <Table.Tr data-testid="permeability-row" data-layer-id={layer.id}>
      <Table.Td ff="monospace" fw={600}>
        {layer.id}
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">
          {t(origin === "fill" ? "web.section.origin.fill" : "web.section.origin.profile")}
        </Text>
      </Table.Td>
      <Table.Td ff="monospace" fz="xs">
        {layer.top.toFixed(2)}–{layer.bottom.toFixed(2)}
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          w={130}
          inputMode="decimal"
          placeholder="1e-5"
          aria-label={t("walls.perm.input_label", { id: layer.id })}
          value={text}
          error={error ? t("walls.perm.invalid") : undefined}
          onChange={(e) => {
            setText(e.currentTarget.value);
            setError(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
      </Table.Td>
      <Table.Td>
        {stored === null ? (
          <Badge size="xs" variant="light" color="gray" style={{ overflow: "visible" }}>
            {t("walls.perm.class.none")}
          </Badge>
        ) : (
          <Badge size="xs" variant="light" color={stored < IMPERVIOUS_BELOW_K ? "teal" : "orange"} style={{ overflow: "visible" }}>
            {t(stored < IMPERVIOUS_BELOW_K ? "walls.perm.class.impervious" : "walls.perm.class.pervious")}
          </Badge>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * Hydraulic conductivity k [m/s] of the structure's soil layers (`SoilLayer.permeability`), the input of
 * the "by permeability" submerged seismic mode. Edits the same undoable soil draft as the layer editor.
 */
export function PermeabilityEditor({ soil, onChange }: PermeabilityEditorProps) {
  const { t } = useTranslation();
  const fill = soil.retained_fill ?? [];
  const profile = soil.profile.layers;

  const setFill = (i: number, k: number | null) =>
    onChange({ ...soil, retained_fill: fill.map((l, j) => (j === i ? withPermeability(l, k) : l)) });
  const setProfile = (i: number, k: number | null) =>
    onChange({ ...soil, profile: { ...soil.profile, layers: profile.map((l, j) => (j === i ? withPermeability(l, k) : l)) } });

  return (
    <Card withBorder padding="sm" radius="sm" data-testid="permeability-editor">
      <Stack gap="xs">
        <div>
          <Text fw={600} size="sm">
            {t("walls.perm.title")}
          </Text>
          <Text size="xs" c="dimmed">
            {t("walls.perm.hint", { limit: "5·10⁻⁴" })}
          </Text>
        </div>
        <Group>
          <Table withTableBorder withColumnBorders verticalSpacing={3} style={{ maxWidth: 640 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("walls.perm.col.layer")}</Table.Th>
                <Table.Th>{t("walls.perm.col.origin")}</Table.Th>
                <Table.Th>{t("walls.perm.col.depth")}</Table.Th>
                <Table.Th>{t("walls.perm.col.k")}</Table.Th>
                <Table.Th>{t("walls.perm.col.class")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fill.map((layer, i) => (
                <PermeabilityRow key={`f-${layer.id}-${layerPermeability(layer)}`} layer={layer} origin="fill" onCommit={(k) => setFill(i, k)} />
              ))}
              {profile.map((layer, i) => (
                <PermeabilityRow key={`p-${layer.id}-${layerPermeability(layer)}`} layer={layer} origin="profile" onCommit={(k) => setProfile(i, k)} />
              ))}
            </Table.Tbody>
          </Table>
        </Group>
      </Stack>
    </Card>
  );
}
