import { useCallback, useEffect, useState } from "react";
import { Button, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { list_structures } from "../../../shared/api/client";
import type { StructureSummary } from "../../../shared/api/types";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";

export function SheetPileDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sid } = useParams();

  const [structure, setStructure] = useState<StructureSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await list_structures();
      setStructure(list.find((s) => s.id === sid && s.kind === "sheet_pile") ?? null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sid]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Button
      size="xs"
      variant="subtle"
      leftSection={<IconArrowLeft size={14} />}
      onClick={() => navigate("/m/sheet_pile")}
    >
      {t("web.common.back_to_list")}
    </Button>
  );

  if (loading) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  if (error != null) {
    return (
      <Stack gap="md">
        {back}
        <ErrorAlert error={error} onRetry={() => void load()} />
      </Stack>
    );
  }

  if (!structure) {
    return (
      <Stack gap="md">
        {back}
        <EmptyState
          title={t("sheet_pile.detail.not_found_title")}
          description={t("sheet_pile.detail.not_found_desc")}
        />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {back}
      <Title order={3}>{structure.name}</Title>
      <EmptyState
        title={t("sheet_pile.detail.placeholder_title")}
        description={t("sheet_pile.detail.placeholder_desc")}
      />
    </Stack>
  );
}
