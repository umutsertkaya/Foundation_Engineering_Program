import { Navigate, Route, Routes } from "react-router-dom";
import { AnalysisPage } from "./pages/AnalysisPage";
import { AnchorPage } from "./pages/AnchorPage";

export default function Root() {
  return (
    <Routes>
      <Route index element={<AnalysisPage />} />
      <Route path="anchor" element={<AnchorPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
