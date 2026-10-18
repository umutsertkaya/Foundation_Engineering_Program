import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBox, IconWall } from "@tabler/icons-react";
import { list_wall_types } from "../api";
import { ApiError, create_structure } from "../../../shared/api/client";
import type { WallType, WallTypeInfo } from "../../../shared/api/types";

/** Retaining wall type picker and creation screen (`/m/walls/new`). */
export function WallTypePicker() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [types, setTypes] = useState<WallTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [selected, setSelected] = useState<WallType | null>(null);
  const [name, setName] = useState("");
  const [height, setHeight] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    list_wall_types()
      .then((data) => {
        if (active) {
          setTypes(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <Loader />;
  }

  if (loadError) {
    return <Alert color="red">{t("walls.type_picker.load_error")}</Alert>;
  }

  const selectedInfo = types.find((info) => info.id === selected);

  async function handleCreate() {
    if (!selected || !selectedInfo) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await create_structure({
        kind: "retaining_wall",
        name: name.trim() || t(selectedInfo.title_key),
        wall_type: selected,
        height,
      });
      notifications.show({
        color: "green",
        message: t("walls.type_picker.created"),
      });
      navigate(`/m/walls/s/${encodeURIComponent(created.id)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        throw err;
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack gap="lg" maw={880}>
      <Stack gap={4}>
        <Title order={2}>{t("walls.type_picker.title")}</Title>
        <Text c="dimmed">{t("walls.type_picker.subtitle")}</Text>
      </Stack>

      <SimpleGrid
        cols={{ base: 1, sm: 2 }}
        role="radiogroup"
        aria-label={t("walls.type_picker.title")}
      >
        {types.map((info) => {
          const isSelected = selected === info.id;
          const Icon =
            info.id === "gravity"
              ? IconBox
              : info.id === "cantilever"
                ? IconWall
                : IconWall;
          return (
            <UnstyledButton
              key={info.id}
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(info.id)}
            >
              <Card
                withBorder
                padding="lg"
                radius="md"
                h="100%"
                style={
                  isSelected
                    ? {
                        borderColor: "var(--mantine-primary-color-filled)",
                        borderWidth: 2,
                      }
                    : undefined
                }
              >
                <Group align="flex-start" wrap="nowrap">
                  <ThemeIcon
                    size="lg"
                    radius="md"
                    variant={isSelected ? "filled" : "light"}
                  >
                    <Icon size={22} />
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Text fw={600}>{t(info.title_key)}</Text>
                    <Text size="sm" c="dimmed">
                      {t(`${info.title_key}.description`)}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>

      <TextInput
        label={t("walls.type_picker.name")}
        placeholder={selectedInfo ? t(selectedInfo.title_key) : undefined}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />

      <NumberInput
        label={t("walls.type_picker.height")}
        value={height}
        onChange={(val) =>
          setHeight(typeof val === "number" ? val : Number(val) || 5)
        }
        min={1}
        max={15}
        step={0.5}
        decimalScale={2}
      />

      {submitError && <Alert color="red">{submitError}</Alert>}

      <Group justify="flex-end">
        <Button variant="default" onClick={() => navigate("/m/walls")}>
          {t("walls.type_picker.cancel")}
        </Button>
        <Button
          disabled={!selected || submitting}
          loading={submitting}
          onClick={handleCreate}
        >
          {t("walls.type_picker.create")}
        </Button>
      </Group>
    </Stack>
  );
}
