import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { get_i18n } from "./shared/api/client";
import { getMockCatalog } from "./shared/api/mock";
import type { Language } from "./shared/api/types";

const LANG_STORAGE_KEY = "geotek.lang";

export function getInitialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "tr" || saved === "en") {
      return saved;
    }
  } catch {
    // localStorage may be unavailable
  }
  return "tr";
}

void i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: getMockCatalog("tr") },
    en: { translation: getMockCatalog("en") },
  },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    prefix: "{",
    suffix: "}",
    escapeValue: false,
  },
});

export async function loadLanguageCatalog(lang: Language): Promise<void> {
  try {
    const catalog = await get_i18n(lang);
    i18n.addResourceBundle(lang, "translation", catalog, true, true);
  } catch {
    // Fallback to embedded catalog when offline or 501 stub is active
    i18n.addResourceBundle(lang, "translation", getMockCatalog(lang), true, true);
  }
  await i18n.changeLanguage(lang);
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors
  }
}

export default i18n;
