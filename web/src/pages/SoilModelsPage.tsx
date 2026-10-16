import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ApiError, get_project, list_profiles } from "../api/client";
import type { ProfileSummary } from "../api/types";
import { EmptyState } from "../components/EmptyState";

export function SoilModelsPage() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profList, proj] = await Promise.all([list_profiles(), get_project()]);
      setProfiles(profList);
      setActiveId(proj.active_profile_id);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  if (loading && profiles.length === 0) {
    return <Text size="sm">{t("web.common.loading")}</Text>;
  }

  return (
    <Stack gap="md">
      <div>
        <Title order={3}>{t("web.soil.title")}</Title>
        <Text size="sm" c="dimmed">
          {t("web.soil.subtitle")}
        </Text>
      </div>

      {error && (
        <Alert color="red" title={t(`error.${error.code}`)}>
          <Text size="xs">{error.message}</Text>
        </Alert>
      )}

      {profiles.length === 0 ? (
        <EmptyState
          title={t("web.soil.empty_title")}
          description={t("web.soil.empty_desc")}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {profiles.map((profile) => {
            const isActive = profile.id === activeId;
            return (
              <Card key={profile.id} withBorder padding="sm" radius="sm">
                <Stack gap="xs">
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={700} size="sm">
                      {profile.name}
                    </Text>
                    <Group gap={6} wrap="nowrap">
                      {isActive && (
                        <Badge size="xs" color="green" variant="filled">
                          {t("web.soil.active_badge")}
                        </Badge>
                      )}
                      <Badge size="xs" color="blue" variant="light">
                        {t(`web.soil.origin.${profile.origin}`)}
                      </Badge>
                      <Badge size="xs" color="gray" variant="outline">
                        {t("web.soil.layer_count", { count: profile.layer_count })}
                      </Badge>
                    </Group>
                  </Group>

                  <Group gap="md">
                    <Text size="xs" c="dimmed">
                      {t("ui.profile.gwt_insitu")}:{" "}
                      <Text span ff="monospace" fw={600}>
                        {profile.gwt.depth_insitu.toFixed(1)} m
                      </Text>
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("ui.profile.gwt_design")}:{" "}
                      <Text span ff="monospace" fw={600}>
                        {(profile.gwt.depth_design ?? profile.gwt.depth_insitu).toFixed(1)} m
                      </Text>
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("ui.profile.gwt_seismic")}:{" "}
                      <Text span ff="monospace" fw={600}>
                        {(profile.gwt.depth_seismic ?? profile.gwt.depth_insitu).toFixed(1)} m
                      </Text>
                    </Text>
                  </Group>

                  <Text size="xs" c="dimmed">
                    {t("web.soil.sources")}:{" "}
                    <Text span ff="monospace">
                      {profile.source_ids.length > 0
                        ? profile.source_ids.join(", ")
                        : t("web.common.none")}
                    </Text>
                  </Text>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}
