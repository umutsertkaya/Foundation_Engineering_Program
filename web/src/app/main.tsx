import React from "react";
import { createRoot } from "react-dom/client";
import { localStorageColorSchemeManager, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { BrowserRouter } from "react-router-dom";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./global.css";

import { App } from "./App";
import { getInitialLanguage, loadLanguageCatalog } from "./i18n";
import { theme } from "./theme";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "geotek.color-scheme",
});

async function bootstrap(): Promise<void> {
  const initialLang = getInitialLanguage();
  await loadLanguageCatalog(initialLang);

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element #root not found");
  }

  createRoot(rootElement).render(
    <React.StrictMode>
      <MantineProvider
        theme={theme}
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="light"
      >
        <Notifications position="top-right" />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MantineProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
