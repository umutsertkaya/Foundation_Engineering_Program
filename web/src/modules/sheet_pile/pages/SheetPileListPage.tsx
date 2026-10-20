import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { list_structures } from "../../../shared/api/client";
import type { StructureSummary } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";

export function SheetPileListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [structures, setStructures] = useState<StructureSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await list_structures();
      setStructures(list.filter((s) => s.kind === "sheet_pile"));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  const open = (id: string) => navigate(`/m/sheet_pile/s/${encodeURIComponent(id)}`);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>{t("sheet_pile.nav.list")}</Title>
          <Text size="sm" c="dimmed">
            {t("sheet_pile.list.subtitle")}
          </Text>
        </div>
        <Button size="xs" onClick={() => navigate("/m/sheet_pile/new")}>
          {t("sheet_pile.list.new")}
        </Button>
      </Group>

      {error != null && <ErrorAlert error={error} onRetry={() => void load()} />}

      {error == null && structures.length === 0 && (
        <EmptyState title={t("sheet_pile.list.empty_title")} description={t("sheet_pile.list.empty_desc")} />
      )}

      {structures.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {structures.map((s) => (
            <Card
              key={s.id}
              withBorder
              padding="sm"
              radius="sm"
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              onClick={() => open(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(s.id);
                }
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Text fw={700} size="sm">
                  {s.name}
                </Text>
                {s.stale && (
                  <Badge size="xs" color="amber" variant="light">
                    {t("web.structures.badge.stale")}
                  </Badge>
                )}
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
