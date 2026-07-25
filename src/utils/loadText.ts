type YamlModules = Record<string, () => Promise<{ default: unknown }>>;

const modules = import.meta.glob("../data/text/**/*.yaml") as YamlModules;

const CONTENT_ALIASES: Record<string, string> = {
  "projects/demo/den_haag": "projects/democrats_abroad/den_haag",
  "projects/demo/oslo": "projects/democrats_abroad/oslo",
};

function resolveAliasedPath(path: string): string {
  for (const [alias, target] of Object.entries(CONTENT_ALIASES)) {
    if (path === alias || path.startsWith(`${alias}/`)) {
      return target + path.slice(alias.length);
    }
  }
  return path;
}

export async function loadText<T = Record<string, unknown>>(
  lang: string,
  path: string,
): Promise<T | null> {
  const resolvedPath = resolveAliasedPath(path);
  const key = `../data/text/${lang}/${resolvedPath}.yaml`;
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
