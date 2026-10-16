import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { get_i18n } from "../shared/api/client";
import enCatalog from "../../../geotek/i18n/en.json";
import trCatalog from "../../../geotek/i18n/tr.json";
import type { Language } from "../shared/api/types";

const LANG_STORAGE_KEY = "geotek.lang";
const moduleFragments = import.meta.glob<Record<string, string>>(
  "../../../geotek/modules/*/i18n/*.json",
  { eager: true, import: "default" },
);

export function getBundledCatalog(lang: Language): Record<string, string> {
  const catalog: Record<string, string> = { ...(lang === "en" ? enCatalog : trCatalog) };
  for (const [path, fragment] of Object.entries(moduleFragments)) {
    if (path.endsWith(`/${lang}.json`)) Object.assign(catalog, fragment);
  }
  return catalog;
}

export function getInitialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "tr" || saved === "en") return saved;
  } catch {
    // localStorage may be unavailable.
  }
  return "tr";
}

void i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: getBundledCatalog("tr") },
    en: { translation: getBundledCatalog("en") },
  },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  keySeparator: false,
  nsSeparator: false,
  interpolation: { prefix: "{", suffix: "}", escapeValue: false },
});

export async function loadLanguageCatalog(lang: Language): Promise<void> {
  const bundled = getBundledCatalog(lang);
  try {
    const catalog = await get_i18n(lang);
    i18n.addResourceBundle(lang, "translation", { ...bundled, ...catalog }, true, true);
  } catch {
    i18n.addResourceBundle(lang, "translation", bundled, true, true);
  }
  await i18n.changeLanguage(lang);
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors.
  }
}

export default i18n;
