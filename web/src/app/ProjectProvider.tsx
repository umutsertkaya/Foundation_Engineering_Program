import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { get_project } from "../shared/api/client";
import {
  close_project,
  create_library_project,
  get_session,
  open_library_project,
  save_current_project,
} from "../shared/api/core";
import type { LibraryEntry, NewProjectRequest, ProjectSummary, SessionInfo } from "../shared/api/types";

interface ProjectSessionContextValue {
  session: SessionInfo;
  project: ProjectSummary | null;
  loading: boolean;
  error: unknown;
  refresh(): Promise<void>;
  save(): Promise<void>;
  close(): Promise<void>;
  openFromLibrary(file: string): Promise<void>;
  createInLibrary(req: NewProjectRequest): Promise<LibraryEntry>;
}

const ProjectSessionContext = createContext<ProjectSessionContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo>({ open: false, file: null, dirty: false });
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSession = await get_session();
      const nextProject = nextSession.open ? await get_project() : null;
      setSession(nextSession);
      setProject(nextProject);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const save = useCallback(async () => {
    const nextSession = await save_current_project();
    const nextProject = nextSession.open ? await get_project() : null;
    // Keep the module mounted while saving so its local editor state survives.
    setSession(nextSession);
    setProject(nextProject);
  }, []);
  const close = useCallback(async () => {
    await close_project();
    await refresh();
  }, [refresh]);
  const openFromLibrary = useCallback(async (file: string) => {
    await open_library_project(file);
    await refresh();
  }, [refresh]);
  const createInLibrary = useCallback(async (req: NewProjectRequest) => {
    const entry = await create_library_project(req);
    await refresh();
    return entry;
  }, [refresh]);

  const value = useMemo(() => ({
    session, project, loading, error, refresh, save, close, openFromLibrary, createInLibrary,
  }), [session, project, loading, error, refresh, save, close, openFromLibrary, createInLibrary]);

  return <ProjectSessionContext.Provider value={value}>{children}</ProjectSessionContext.Provider>;
}

export function useProjectSession(): ProjectSessionContextValue {
  const context = useContext(ProjectSessionContext);
  if (!context) throw new Error("useProjectSession must be used inside ProjectProvider");
  return context;
}
