import { useState, useEffect, useContext, startTransition } from "react";
import { LanguageContext } from "../i18n/LanguageContext";
import type { Location } from "../types/data";

type YamlModules = Record<string, () => Promise<{ default: unknown }>>;

const modules = import.meta.glob("../data/text/**/*.yaml") as YamlModules;

export function useLocations(
  paths: string[] | null,
): { locations: Location[]; loading: boolean } {
  const { currentLang } = useContext(LanguageContext);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(
    !paths || paths.length === 0 ? false : true,
  );

  useEffect(() => {
    if (!paths || paths.length === 0) {
      startTransition(() => {
        setLocations([]);
        setLoading(false);
      });
      return;
    }
    startTransition(() => {
      setLoading(true);
    });
    Promise.all(
      paths.map((path) => {
        const key = `../data/text/${currentLang}/${path}.yaml`;
        const loader = modules[key];
        return loader
          ? loader().then((m) => m.default as Location)
          : Promise.resolve(null);
      }),
    )
      .then((results) => {
        setLocations(results.filter((r): r is Location => r !== null));
        setLoading(false);
      })
      .catch(() => {
        setLocations([]);
        setLoading(false);
      });
  }, [currentLang, JSON.stringify(paths)]); // eslint-disable-line react-hooks/exhaustive-deps

  return { locations, loading };
}