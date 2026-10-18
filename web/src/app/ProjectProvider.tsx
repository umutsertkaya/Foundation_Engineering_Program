import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

export interface RefreshOptions {
  /** Never touches the shared `error` state (callers handle the rejection themselves). */
  silent?: boolean;
}

interface ProjectSessionContextValue {
  session: SessionInfo;
  project: ProjectSummary | null;
  /** True only until the first load completes; later refreshes never unmount the page. */
  loading: boolean;
  error: unknown;
  refresh(options?: RefreshOptions): Promise<void>;
  /** GET /session only: cheap way to update the dirty badge. Rejects on failure. */
  refreshSession(): Promise<void>;
  /** Fire-and-forget refreshSession() for modules after an edit; failures are ignored. */
  markDirty(): void;
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
  // Request-sequence guards: only the newest request may write its result.
  const fullSeq = useRef(0);
  const sessionSeq = useRef(0);

  const refresh = useCallback(async (options?: RefreshOptions) => {
    const fullId = ++fullSeq.current;
    const sessionId = ++sessionSeq.current;
    try {
      const nextSession = await get_session();
      const nextProject = nextSession.open ? await get_project() : null;
      if (fullId !== fullSeq.current) return;
      // A newer session-only refresh may already have written a fresher session.
      if (sessionId === sessionSeq.current) setSession(nextSession);
      setProject(nextProject);
      if (!options?.silent) setError(null);
    } catch (err) {
      if (fullId === fullSeq.current && !options?.silent) setError(err);
      throw err;
    } finally {
      if (fullId === fullSeq.current) setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const sessionId = ++sessionSeq.current;
    const nextSession = await get_session();
    if (sessionId === sessionSeq.current) setSession(nextSession);
  }, []);

  const markDirty = useCallback(() => {
    void refreshSession().catch(() => undefined);
  }, [refreshSession]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const save = useCallback(async () => {
    const fullId = ++fullSeq.current;
    const sessionId = ++sessionSeq.current;
    const nextSession = await save_current_project();
    const nextProject = nextSession.open ? await get_project() : null;
    if (fullId !== fullSeq.current) return;
    // Keep the module mounted while saving so its local editor state survives.
    if (sessionId === sessionSeq.current) setSession(nextSession);
    setProject(nextProject);
    setLoading(false);
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
    session, project, loading, error, refresh, refreshSession, markDirty, save, close, openFromLibrary, createInLibrary,
  }), [session, project, loading, error, refresh, refreshSession, markDirty, save, close, openFromLibrary, createInLibrary]);

  return <ProjectSessionContext.Provider value={value}>{children}</ProjectSessionContext.Provider>;
}

export function useProjectSession(): ProjectSessionContextValue {
  const context = useContext(ProjectSessionContext);
  if (!context) throw new Error("useProjectSession must be used inside ProjectProvider");
  return context;
}
