import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Language } from './translations';
import { translations, LANGUAGE_LABELS } from './translations';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      return (localStorage.getItem('prism-lang') as Language) || 'en';
    } catch { return 'en'; }
  });

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { localStorage.setItem('prism-lang', l); } catch {}
  }, []);

  const t = useCallback((key: string) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
export { LANGUAGE_LABELS };
export type { Language };
