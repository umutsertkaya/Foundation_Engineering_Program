import { Navigate, Route, Routes } from "react-router-dom";
import { AnalysisPage } from "./pages/AnalysisPage";
import { ResultsPage } from "./pages/ResultsPage";

export default function Root() {
  return (
    <Routes>
      <Route index element={<AnalysisPage />} />
      <Route path="results" element={<ResultsPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
}
