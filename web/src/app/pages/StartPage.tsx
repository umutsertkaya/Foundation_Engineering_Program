import { useEffect, useState } from "react";
import { Button, Container, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { list_library } from "../../shared/api/core";
import type { LibraryEntry } from "../../shared/api/types";
import { ErrorAlert } from "../../shared/components/ErrorAlert";
import { useProjectSession } from "../ProjectProvider";

export function StartPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openFromLibrary } = useProjectSession();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    void list_library().then((items) => { if (active) setEntries(items); })
      .catch((err: unknown) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <Container py="xl"><Stack>
      <Title>{t("start.app_title")}</Title>
      {error != null && <ErrorAlert error={error} />}
      {loading ? <Loader /> : entries.map((entry) => (
        <Group key={entry.file} justify="space-between">
          <Text>{entry.name}</Text>
          <Button disabled={entry.error != null} onClick={() => {
            void openFromLibrary(entry.file).then(() => navigate("/launcher")).catch(setError);
          }}>{t("start.action.open")}</Button>
        </Group>
      ))}
    </Stack></Container>
  );
}
