import { Navigate, Route, Routes } from "react-router-dom";
import { SiteDataPage } from "./pages/SiteDataPage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { ParametersPage } from "./pages/ParametersPage";
import { ClassificationPage } from "./pages/ClassificationPage";

export default function Root() {
  return (
    <Routes>
      <Route index element={<SiteDataPage />} />
      <Route path="profiles" element={<ProfilesPage />} />
      <Route path="parameters" element={<ParametersPage />} />
      <Route path="classification" element={<ClassificationPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
