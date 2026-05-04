import { useState, useEffect, useContext, startTransition } from "react";
import { LanguageContext } from "../i18n/LanguageContext";

type YamlModules = Record<string, () => Promise<{ default: unknown }>>;

const modules = import.meta.glob("../data/text/**/*.yaml") as YamlModules;

export function useText<T = Record<string, unknown>>(
  path: string,
): { text: T | null; loading: boolean } {
  const { currentLang } = useContext(LanguageContext);
  const [text, setText] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    const key = `../data/text/${currentLang}/${path}.yaml`;
    return !!modules[key];
  });

  useEffect(() => {
    const key = `../data/text/${currentLang}/${path}.yaml`;
    const loader = modules[key];
    if (!loader) {
      startTransition(() => {
        setText(null);
        setLoading(false);
      });
      return;
    }
    startTransition(() => {
      setLoading(true);
    });
    loader()
      .then((mod) => {
        setText(mod.default as T);
        setLoading(false);
      })
      .catch(() => {
        setText(null);
        setLoading(false);
      });
  }, [currentLang, path]);

  return { text, loading };
}