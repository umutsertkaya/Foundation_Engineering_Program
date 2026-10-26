import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconArrowRight, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ApiError, list_structures } from "../../../shared/api/client";
import type { StructureSummary } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { SectionCard } from "../../../shared/components/SectionCard";
import { StatusChip } from "../../../shared/components/StatusChip";

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

  const statusLabel = (s: StructureSummary) =>
    s.stale ? t("walls.status.stale") : s.has_result ? t("walls.status.current") : t("walls.list.not_run");

  if (loading && structures.length === 0) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  const newButton = (
    <Button leftSection={<IconPlus size={16} aria-hidden="true" />} onClick={() => navigate("/m/walls/new")}>
      {t("walls.nav.new")}
    </Button>
  );

  return (
    <Stack gap="md">
      <PageHeader title={t("walls.nav.list")} lead={t("walls.list.lead")} actions={newButton} />

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}

      {structures.length === 0 ? (
        <EmptyState title={t("walls.list.empty_title")} description={t("walls.list.empty_desc")} action={newButton} />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {structures.map((s) => (
            <SectionCard
              key={s.id}
              title={s.name}
              aside={<StatusChip tone={s.stale ? "stale" : s.has_result ? "current" : "neutral"}>{statusLabel(s)}</StatusChip>}
            >
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" c="dimmed">
                  {s.wall_type ? t(`ui.wall.${s.wall_type}`) : t(`web.structures.kind.${s.kind}`)}
                </Text>
                <Button
                  variant="default"
                  size="compact-sm"
                  rightSection={<IconArrowRight size={14} aria-hidden="true" />}
                  onClick={() => navigate(`/m/walls/s/${s.id}`)}
                >
                  {t("web.common.open")}
                </Button>
              </Group>
            </SectionCard>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
