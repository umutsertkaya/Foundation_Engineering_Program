import { useEffect, useState } from "react";
import { Alert, Badge, Card, Collapse, Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { get_layer_inventory } from "../api";
import type { LayerInventory } from "../types";

/** Inputs that are not measurements: the engineer must supply or approve them first. */
const MISSING_INPUT_KEYS: Record<string, string> = {
  uscs: "web.inventory.uscs_needed",
  phi_approved: "web.inventory.phi_approved_needed",
  ocr_approved: "web.inventory.ocr_approved_needed",
};

/** What data the layer provides and which correlations it enables; failures hide the panel. */
export function LayerInventoryPanel({ profileId, layerId }: { profileId: string; layerId: string }) {
  const { t } = useTranslation();
  const [inventory, setInventory] = useState<LayerInventory | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    setInventory(null);
    get_layer_inventory(profileId, layerId).then((v) => live && setInventory(v)).catch(() => undefined);
    return () => { live = false; };
  }, [profileId, layerId]);

  if (!inventory) return null;
  const blocked = inventory.keys.flatMap((k) =>
    k.methods.filter((m) => m.ready_points === 0).map((m) => ({ ...m, parameter: k.parameter })));
  return (
    <Card withBorder padding="xs" radius="sm" data-testid="layer-inventory">
      {inventory.stress_issue === "gamma_sat_missing" && (
        <Alert color="red" variant="light" mb="xs" data-testid="inventory-gamma-sat-missing">
          {t("soil.params.gamma_sat_missing_below_gwt")}
        </Alert>
      )}
      <UnstyledButton onClick={() => setOpen(!open)}>
        <Text size="sm" fw={600}>
          {t("web.inventory.title", { count: inventory.point_count })} {open ? "▾" : "▸"}
        </Text>
      </UnstyledButton>
      <Collapse in={open}>
        <Stack gap={6} mt="xs">
          <Group gap={4}>
            {Object.entries(inventory.inputs).map(([name, n]) => (
              <Badge key={name} size="xs" variant="light" color={n === inventory.point_count ? "green" : "gray"}>
                {name} {n}/{inventory.point_count}
              </Badge>
            ))}
          </Group>
          {inventory.spt_class && (
            <Text size="xs" data-testid="inventory-spt-class">
              {t("web.inventory.spt_class", {
                name: t(`web.inventory.spt_class.${inventory.spt_class}`, { defaultValue: inventory.spt_class }),
              })}
            </Text>
          )}
          {blocked.length > 0 && <Text size="xs" fw={600}>{t("web.inventory.blocked")}</Text>}
          {blocked.map((m) => (
            <Text key={m.id} size="xs" c="dimmed">
              {m.parameter} · {m.id}: {t("web.inventory.needs")}{" "}
              {m.missing_inputs.map((name) => (MISSING_INPUT_KEYS[name] ? t(MISSING_INPUT_KEYS[name]) : name)).join(", ")}
            </Text>
          ))}
        </Stack>
      </Collapse>
    </Card>
  );
}
