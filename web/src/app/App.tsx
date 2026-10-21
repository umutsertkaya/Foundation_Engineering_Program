import { Navigate, Route, Routes } from "react-router-dom";
import { AppChrome } from "./AppChrome";
import { ModuleRegistryContext, useModules } from "./moduleRegistry";
import { ModuleShell } from "./ModuleShell";
import { ProjectProvider } from "./ProjectProvider";
import { RequireProject } from "./RequireProject";
import { LauncherPage } from "./pages/LauncherPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StartPage } from "./pages/StartPage";

export function App() {
  const modules = useModules();
  return (
    <ModuleRegistryContext.Provider value={modules}>
      <ProjectProvider>
        <AppChrome />
        <Routes>
          <Route path="/" element={<Navigate to="/start" replace />} />
          <Route path="/start" element={<StartPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/launcher" element={<RequireProject><LauncherPage /></RequireProject>} />
          <Route path="/m/:moduleId/*" element={<RequireProject><ModuleShell /></RequireProject>} />
          <Route path="*" element={<Navigate to="/start" replace />} />
        </Routes>
      </ProjectProvider>
    </ModuleRegistryContext.Provider>
  );
}

export default App;
