import { Navigate, Route, Routes } from "react-router-dom";
import { WallListPage } from "./pages/WallListPage";
import { WallTypePicker } from "./pages/WallTypePicker";
import { WallWizardPage } from "./pages/WallWizardPage";

export default function Root() {
  return (
    <Routes>
      <Route index element={<WallListPage />} />
      <Route path="new" element={<WallTypePicker />} />
      <Route path="s/:sid/*" element={<WallWizardPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
