const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export interface ImageEntry {
  filename: string;
  url: string;
}

export function parseImageModules(modules: Record<string, unknown>): ImageEntry[] {
  return Object.entries(modules)
    .filter(([path]) =>
      ALLOWED_EXTENSIONS.has(path.slice(path.lastIndexOf(".")).toLowerCase()),
    )
    .map(([path, url]) => ({
      filename: path.split("/").at(-1)!,
      url: url as string,
    }));
}

export function getAvailableImages(): ImageEntry[] {
  return parseImageModules(
    import.meta.glob("/src/data/img/*", {
      eager: true,
      query: "?url",
      import: "default",
    }) as Record<string, unknown>,
  );
}
