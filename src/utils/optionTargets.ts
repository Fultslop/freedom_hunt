export function resolvePageUrl(
  value: "title" | "project" | "start_route" | "gallery" | "results",
  ctx: { project: string; city: string; route?: string },
): string {
  switch (value) {
    case "title":
      return `/${ctx.project}/${ctx.city}`;
    case "project":
      return `/${ctx.project}`;
    case "gallery":
      return `/${ctx.project}/${ctx.city}/gallery`;
    case "results":
      return `/${ctx.project}/${ctx.city}/results_download`;
    case "start_route":
      return `/${ctx.project}/${ctx.city}/${ctx.route}`;
  }
}
