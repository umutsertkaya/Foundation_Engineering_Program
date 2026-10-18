import { Button } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../../shared/components/EmptyState";

export function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <EmptyState
      title={t("liquefaction.results.title")}
      description={t("liquefaction.results.pending")}
      action={
        <Button variant="default" onClick={() => navigate("/m/liquefaction")}>
          {t("liquefaction.results.back")}
        </Button>
      }
    />
  );
}
