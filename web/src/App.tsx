import { Navigate, Route, Routes } from "react-router-dom";
import { AppShellLayout } from "./components/AppShellLayout";
import { ProjectPage } from "./pages/ProjectPage";
import { ReportPage } from "./pages/ReportPage";
import { SiteDataPage } from "./pages/SiteDataPage";
import { SoilModelsPage } from "./pages/SoilModelsPage";
import { StructuresPage } from "./pages/StructuresPage";
import { StructureWizardPage } from "./pages/StructureWizardPage";

export function App() {
  return (
    <AppShellLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/project" replace />} />
        <Route path="/project" element={<ProjectPage />} />
        <Route path="/site-data" element={<SiteDataPage />} />
        <Route path="/soil-models" element={<SoilModelsPage />} />
        <Route path="/structures" element={<StructuresPage />} />
        <Route path="/structures/:id" element={<StructureWizardPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/project" replace />} />
      </Routes>
    </AppShellLayout>
  );
}

export default App;
