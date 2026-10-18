import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowRight, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError, list_structures } from "../../../shared/api/client";
import type { StructureSummary } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";

export function WallListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [structures, setStructures] = useState<StructureSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const loadStructures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await list_structures();
      setStructures(list.filter((s) => s.kind === "retaining_wall"));
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
          onClick={() => navigate("/m/walls/new")}
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
              onClick={() => navigate("/m/walls/new")}
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
                    onClick={() => navigate(`/m/walls/s/${s.id}`)}
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

    </Stack>
  );
}
