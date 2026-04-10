import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  APP_LANGUAGE_STORAGE_KEY,
  DEFAULT_APP_LANGUAGE,
  isSupportedAppLanguage,
  SUPPORTED_APP_LANGUAGES,
} from "@/lib/settings";
import bgCommon from "@/locales/bg/common.json";
import csCommon from "@/locales/cs/common.json";
import daCommon from "@/locales/da/common.json";
import deCommon from "@/locales/de/common.json";
import enCommon from "@/locales/en/common.json";
import etCommon from "@/locales/et/common.json";
import esCommon from "@/locales/es/common.json";
import fiCommon from "@/locales/fi/common.json";
import frCommon from "@/locales/fr/common.json";
import hrCommon from "@/locales/hr/common.json";
import huCommon from "@/locales/hu/common.json";
import itCommon from "@/locales/it/common.json";
import jaCommon from "@/locales/ja/common.json";
import kaCommon from "@/locales/ka/common.json";
import koCommon from "@/locales/ko/common.json";
import ltCommon from "@/locales/lt/common.json";
import lvCommon from "@/locales/lv/common.json";
import nbCommon from "@/locales/nb/common.json";
import nlCommon from "@/locales/nl/common.json";
import plCommon from "@/locales/pl/common.json";
import ptBrCommon from "@/locales/pt-BR/common.json";
import roCommon from "@/locales/ro/common.json";
import ruCommon from "@/locales/ru/common.json";
import srCommon from "@/locales/sr/common.json";
import svCommon from "@/locales/sv/common.json";
import ukCommon from "@/locales/uk/common.json";
import zhHansCommon from "@/locales/zh-Hans/common.json";
import zhHantCommon from "@/locales/zh-Hant/common.json";

const initialLanguage = (() => {
  if (typeof window === "undefined") {
    return DEFAULT_APP_LANGUAGE;
  }

  const storedLanguage = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  return isSupportedAppLanguage(storedLanguage)
    ? storedLanguage
    : DEFAULT_APP_LANGUAGE;
})();

void i18n.use(initReactI18next).init({
  resources: {
    bg: {
      common: bgCommon,
    },
    cs: {
      common: csCommon,
    },
    da: {
      common: daCommon,
    },
    en: {
      common: enCommon,
    },
    de: {
      common: deCommon,
    },
    et: {
      common: etCommon,
    },
    es: {
      common: esCommon,
    },
    fi: {
      common: fiCommon,
    },
    fr: {
      common: frCommon,
    },
    hr: {
      common: hrCommon,
    },
    hu: {
      common: huCommon,
    },
    it: {
      common: itCommon,
    },
    ja: {
      common: jaCommon,
    },
    ka: {
      common: kaCommon,
    },
    ko: {
      common: koCommon,
    },
    lt: {
      common: ltCommon,
    },
    lv: {
      common: lvCommon,
    },
    nb: {
      common: nbCommon,
    },
    nl: {
      common: nlCommon,
    },
    pl: {
      common: plCommon,
    },
    "pt-BR": {
      common: ptBrCommon,
    },
    ro: {
      common: roCommon,
    },
    ru: {
      common: ruCommon,
    },
    sr: {
      common: srCommon,
    },
    sv: {
      common: svCommon,
    },
    uk: {
      common: ukCommon,
    },
    "zh-Hans": {
      common: zhHansCommon,
    },
    "zh-Hant": {
      common: zhHantCommon,
    },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_APP_LANGUAGE,
  supportedLngs: SUPPORTED_APP_LANGUAGES,
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
