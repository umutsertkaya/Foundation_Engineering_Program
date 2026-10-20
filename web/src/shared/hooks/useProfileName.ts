import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { list_project_profiles } from "../api/core";
import type { ProfileSummary } from "../api/types";

/**
 * Display name of a project soil profile, never its id: the profile's name, the "deleted profile" text
 * when the project no longer has it, "—" when the list cannot be read, and the loading text meanwhile.
 * Returns null when there is no id.
 */
export function useProfileName(id: string | null | undefined): string | null {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileSummary[] | "error" | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setProfiles(null);
    list_project_profiles().then(
      (list) => {
        if (active) setProfiles(list);
      },
      () => {
        if (active) setProfiles("error");
      },
    );
    return () => {
      active = false;
    };
  }, [id]);

  if (!id) return null;
  if (profiles === null) return t("web.common.loading");
  if (profiles === "error") return t("web.common.none");
  const found = profiles.find((p) => p.id === id);
  if (!found) return t("web.common.deleted_profile");
  return found.name.trim() || t("web.common.none");
}
