import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router-dom";
import { EmptyState } from "../../shared/components/EmptyState";

function Placeholder({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return <EmptyState title={t(labelKey)} description={t("sheet_pile.placeholder")} />;
}

export default function Root() {
  return (
    <Routes>
      <Route index element={<Placeholder labelKey="sheet_pile.nav.list" />} />
    </Routes>
  );
}
