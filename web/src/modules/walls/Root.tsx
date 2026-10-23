import { Navigate, Route, Routes } from "react-router-dom";
import { AtRestPage } from "./pages/AtRestPage";
import { WallListPage } from "./pages/WallListPage";
import { WallTypePicker } from "./pages/WallTypePicker";
import { WallWizardPage } from "./pages/WallWizardPage";

export default function Root() {
  return (
    <Routes>
      <Route index element={<WallListPage />} />
      <Route path="at-rest" element={<AtRestPage />} />
      <Route path="new" element={<WallTypePicker />} />
      <Route path="s/:sid/*" element={<WallWizardPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
