import { useEffect, useState } from "react";
import { Alert, Button, Center, Stack, Text, Title } from "@mantine/core";
import { IconPower } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { NETWORK_ERROR_EVENT, isMockMode, request } from "../shared/api/http";
import { get_session } from "../shared/api/core";

/** Program-level controls: quit (local program only) and a lost-connection notice. */
export function AppChrome() {
  const { t } = useTranslation();
  const [canQuit, setCanQuit] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (isMockMode()) return;
    request<{ shutdown: boolean }>("GET", "/launcher")
      .then((info) => setCanQuit(info.shutdown === true))
      .catch(() => undefined);
    const onLost = () => setDisconnected(true);
    window.addEventListener(NETWORK_ERROR_EVENT, onLost);
    return () => window.removeEventListener(NETWORK_ERROR_EVENT, onLost);
  }, []);

  const quit = async () => {
    let dirty = false;
    try {
      const session = await get_session();
      dirty = session.open && session.dirty;
    } catch {
      // Unknown state: ask the more careful question.
      dirty = true;
    }
    if (!window.confirm(t(dirty ? "shell.quit_unsaved_confirm" : "shell.quit_confirm"))) return;
    try {
      await request("POST", "/launcher/shutdown");
      setStopped(true);
    } catch {
      setDisconnected(true);
    }
  };

  if (stopped) {
    return (
      <Center style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--mantine-color-body)" }}>
        <Stack align="center" gap="xs">
          <Title order={3}>{t("shell.stopped_title")}</Title>
          <Text c="dimmed">{t("shell.stopped_desc")}</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      {disconnected && (
        <Alert
          color="red"
          title={t("shell.disconnected_title")}
          withCloseButton
          onClose={() => setDisconnected(false)}
          style={{ position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 1000, maxWidth: 520 }}
        >
          <Text size="sm">{t("shell.disconnected_desc")}</Text>
          <Button size="compact-xs" mt="xs" variant="light" color="red" onClick={() => window.location.reload()}>
            {t("shell.reload")}
          </Button>
        </Alert>
      )}
      {canQuit && (
        <Button
          size="compact-xs"
          variant="default"
          leftSection={<IconPower size={14} />}
          onClick={() => void quit()}
          style={{ position: "fixed", right: 8, bottom: 8, zIndex: 900 }}
        >
          {t("shell.quit")}
        </Button>
      )}
    </>
  );
}
