import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowRight, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError, create_structure, list_structures } from "../shared/api/client";
import type { StructureSummary, WallType } from "../shared/api/types";
import { EmptyState } from "../shared/components/EmptyState";

export function StructuresPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [structures, setStructures] = useState<StructureSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("D-Yeni");
  const [newWallType, setNewWallType] = useState<WallType>("cantilever");
  const [newHeight, setNewHeight] = useState<number>(5.0);

  const loadStructures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await list_structures();
      setStructures(list);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStructures();
  }, [loadStructures]);

  const handleCreateStub = async () => {
    try {
      const created = await create_structure({
        kind: "retaining_wall",
        name: newName.trim() || t("ui.nav.wall"),
        wall_type: newWallType,
        height: newHeight,
      });
      notifications.show({
        color: "green",
        message: t("web.structures.new_stub_msg"),
      });
      setModalOpen(false);
      await loadStructures();
      navigate(`/structures/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    }
  };

  if (loading && structures.length === 0) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>{t("web.structures.title")}</Title>
          <Text size="sm" c="dimmed">
            {t("web.structures.subtitle")}
          </Text>
        </div>
        <Button
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => setModalOpen(true)}
        >
          {t("web.structures.new_btn")}
        </Button>
      </Group>

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}

      {structures.length === 0 ? (
        <EmptyState
          title={t("web.structures.empty_title")}
          description={t("web.structures.empty_desc")}
          action={
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => setModalOpen(true)}
            >
              {t("web.structures.new_btn")}
            </Button>
          }
        />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {structures.map((s) => (
            <Card key={s.id} withBorder padding="sm" radius="sm">
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={700} size="sm">
                    {s.name}
                  </Text>
                  <Button
                    size="compact-xs"
                    variant="light"
                    rightSection={<IconArrowRight size={13} />}
                    onClick={() => navigate(`/structures/${s.id}`)}
                  >
                    {t("web.common.open")}
                  </Button>
                </Group>

                <Group gap={6}>
                  <Badge size="xs" color="blue" variant="light">
                    {t(`web.structures.kind.${s.kind}`)}
                  </Badge>
                  {s.wall_type && (
                    <Badge size="xs" color="indigo" variant="outline">
                      {s.wall_type === "cantilever"
                        ? t("ui.wall.cantilever")
                        : t("ui.wall.gravity")}
                    </Badge>
                  )}
                  <Badge
                    size="xs"
                    color={s.stale ? "amber" : "green"}
                    variant="light"
                  >
                    {s.stale
                      ? t("web.structures.badge.stale")
                      : t("web.structures.badge.fresh")}
                  </Badge>
                  <Badge
                    size="xs"
                    color={s.has_result ? "teal" : "gray"}
                    variant="outline"
                  >
                    {s.has_result
                      ? t("web.structures.badge.has_result")
                      : t("web.structures.badge.no_result")}
                  </Badge>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("web.structures.modal_title")}
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            size="xs"
            label={t("web.project.name")}
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
          />
          <Stack gap={4}>
            <Text size="xs" fw={500}>
              {t("ui.wall.type")}
            </Text>
            <SegmentedControl
              size="xs"
              value={newWallType}
              onChange={(v) => setNewWallType(v as WallType)}
              data={[
                { value: "cantilever", label: t("ui.wall.cantilever") },
                { value: "gravity", label: t("ui.wall.gravity") },
              ]}
            />
          </Stack>
          <NumberInput
            size="xs"
            label={t("ui.wall.height")}
            value={newHeight}
            min={1.0}
            max={15.0}
            step={0.25}
            decimalScale={2}
            onChange={(val) => {
              if (typeof val === "number" && Number.isFinite(val)) {
                setNewHeight(val);
              }
            }}
          />
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="default" onClick={() => setModalOpen(false)}>
              {t("web.common.cancel")}
            </Button>
            <Button size="xs" onClick={() => void handleCreateStub()}>
              {t("web.common.create")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
