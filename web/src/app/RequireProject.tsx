import type { ReactNode } from "react";
import { Loader } from "@mantine/core";
import { Navigate } from "react-router-dom";
import { ErrorAlert } from "../shared/components/ErrorAlert";
import { useProjectSession } from "./ProjectProvider";

export function RequireProject({ children }: { children: ReactNode }) {
  const { session, loading, error, refresh } = useProjectSession();
  if (loading) return <Loader />;
  if (error) return <ErrorAlert error={error} onRetry={() => { void refresh().catch(() => undefined); }} />;
  if (!session.open) return <Navigate to="/start" replace />;
  return <>{children}</>;
}
