import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
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
import { IconBox, IconCheck, IconWall } from "@tabler/icons-react";
import { list_wall_types } from "../api";
import { ApiError, create_structure } from "../../../shared/api/client";
import type { WallType, WallTypeInfo } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";

/** Retaining wall type picker and creation screen (`/m/walls/new`). */
export function WallTypePicker() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [types, setTypes] = useState<WallTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [selected, setSelected] = useState<WallType | null>(null);
  const [name, setName] = useState("");
  const [height, setHeight] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const loadSeq = useRef(0);

  const load = useCallback(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setLoadError(null);
    list_wall_types()
      .then((data) => {
        if (seq !== loadSeq.current) return;
        setTypes(data);
        setSelected((cur) => cur ?? data.find((i) => i.id === "cantilever")?.id ?? data[0]?.id ?? null);
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

  const cancelButton = (
    <Button variant="default" onClick={() => navigate("/m/walls")}>
      {t("walls.type_picker.cancel")}
    </Button>
  );

  if (loading) {
    return <Loader />;
  }

  if (loadError != null) {
    return (
      <Stack gap="md" maw={880}>
        <ErrorAlert error={loadError} />
        <Group>
          <Button onClick={load}>{t("web.common.retry")}</Button>
          {cancelButton}
        </Group>
      </Stack>
    );
  }

  if (types.length === 0) {
    return (
      <EmptyState
        title={t("walls.type_picker.empty_title")}
        description={t("walls.type_picker.empty_desc")}
        action={cancelButton}
      />
    );
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
      setSubmitError(err instanceof ApiError ? err : new Error(t("error.engine_error")));
      setSubmitting(false);
    }
  }

  function handleRadioKey(e: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const step = keys[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = (index + step + types.length) % types.length;
    setSelected(types[next].id);
    cardRefs.current[next]?.focus();
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
        {types.map((info, index) => {
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
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(info.id)}
              onKeyDown={(e) => handleRadioKey(e, index)}
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
                    <Group gap={6} wrap="nowrap">
                      <Text fw={600}>{t(info.title_key)}</Text>
                      {isSelected && <IconCheck size={16} aria-hidden />}
                    </Group>
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
        onChange={(val) => {
          if (typeof val === "number" && Number.isFinite(val)) setHeight(val);
        }}
        min={1}
        max={15}
        step={0.25}
        decimalScale={2}
      />

      {submitError != null && <ErrorAlert error={submitError} />}

      <Group justify="flex-end">
        {cancelButton}
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
