type YamlModules = Record<string, () => Promise<{ default: unknown }>>;

const modules = import.meta.glob("../data/text/**/*.yaml") as YamlModules;

export async function loadText<T = Record<string, unknown>>(
  lang: string,
  path: string,
): Promise<T | null> {
  const key = `../data/text/${lang}/${path}.yaml`;
  const loader = modules[key];
  if (!loader) {
    return null;
  }
  try {
    const mod = await loader();
    return mod.default as T;
  } catch {
    return null;
  }
}
