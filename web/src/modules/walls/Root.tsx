import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import { EmptyState } from "../../shared/components/EmptyState";

function Placeholder({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return <EmptyState title={t(labelKey)} description={t("walls.placeholder")} />;
}

export default function Root() {
  return (
    <Routes>
      <Route index element={<Placeholder labelKey="walls.nav.list" />} />
      <Route path="new" element={<Placeholder labelKey="walls.nav.new" />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
