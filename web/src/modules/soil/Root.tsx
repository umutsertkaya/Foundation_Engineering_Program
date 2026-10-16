import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import { EmptyState } from "../../shared/components/EmptyState";

function Placeholder({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return <EmptyState title={t(labelKey)} description={t("soil.placeholder")} />;
}

export default function Root() {
  return (
    <Routes>
      <Route index element={<Placeholder labelKey="soil.nav.site" />} />
      <Route path="profiles" element={<Placeholder labelKey="soil.nav.profiles" />} />
      <Route path="parameters" element={<Placeholder labelKey="soil.nav.parameters" />} />
      <Route path="classification" element={<Placeholder labelKey="soil.nav.classification" />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
