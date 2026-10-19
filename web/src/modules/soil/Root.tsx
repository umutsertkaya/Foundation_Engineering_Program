import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import { SiteDataPage } from "./pages/SiteDataPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { ParametersPage } from "./pages/ParametersPage";
import { EmptyState } from "../../shared/components/EmptyState";

function Placeholder({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return <EmptyState title={t(labelKey)} description={t("soil.placeholder")} />;
}

export default function Root() {
  return (
    <Routes>
      <Route index element={<SiteDataPage />} />
      <Route path="profiles" element={<ProfilesPage />} />
      <Route path="parameters" element={<ParametersPage />} />
      <Route path="classification" element={<Placeholder labelKey="soil.nav.classification" />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
