import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import { EmptyState } from "../../shared/components/EmptyState";

function Placeholder({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return <EmptyState title={t(labelKey)} description={t("liquefaction.placeholder")} />;
}

export default function Root() {
  return (
    <Routes>
      <Route index element={<Placeholder labelKey="liquefaction.nav.analysis" />} />
      <Route path="results" element={<Placeholder labelKey="liquefaction.nav.results" />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
