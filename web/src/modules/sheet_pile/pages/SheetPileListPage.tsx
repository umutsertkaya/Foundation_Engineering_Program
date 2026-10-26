import { useCallback, useEffect, useState } from "react";
import { Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { list_structures } from "../../../shared/api/client";
import type { StructureSummary } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusChip } from "../../../shared/components/StatusChip";
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

  const newButton = (
    <Button leftSection={<IconPlus size={16} aria-hidden="true" />} onClick={() => navigate("/m/sheet_pile/new")}>
      {t("sheet_pile.list.new")}
    </Button>
  );

  return (
    <Stack gap="md">
      <PageHeader title={t("sheet_pile.nav.list")} lead={t("sheet_pile.list.subtitle")} actions={newButton} />

      {error != null && <ErrorAlert error={error} onRetry={() => void load()} />}

      {error == null && structures.length === 0 && (
        <EmptyState title={t("sheet_pile.list.empty_title")} description={t("sheet_pile.list.empty_desc")} action={newButton} />
      )}

      {structures.length > 0 && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {structures.map((s) => (
            <Card
              key={s.id}
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
                <Text fw={600}>{s.name}</Text>
                <StatusChip tone={s.stale ? "stale" : s.has_result ? "current" : "neutral"}>
                  {s.stale ? t("sheet_pile.status.stale") : s.has_result ? t("sheet_pile.status.current") : t("sheet_pile.status.draft")}
                </StatusChip>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
