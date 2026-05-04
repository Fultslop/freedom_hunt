import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useTheme } from "../theme/ThemeContext";
import { useTitleBar } from "../theme/TitleBarContext";
import { fetchImage } from "../assets/AssetManager";
import RouteSelector from "../components/RouteSelector";
import MarkdownText from "../components/MarkdownText";
import type { RoutesData } from "../types/data";
import "./CityPage.css";

export default function CityPage() {
  const { project, city } = useParams<{ project: string; city: string }>();
  const { text: cityText, loading: cityLoading } = useText(
    `projects/${project}/${city}/${city}`,
  );
  const { text: routesText, loading: routesLoading } =
    useText<RoutesData>(`projects/${project}/${city}/routes`);
  const { text: projectMeta } = useText(`projects/${project}/${project}`);
  const { theme } = useTheme();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (projectMeta && typeof projectMeta === "object" && "project.image" in projectMeta) {
      const meta = projectMeta as { "project.image"?: string };
      if (meta["project.image"]) {
        fetchImage(meta["project.image"]).then(setLogoUrl);
      }
    }
  }, [projectMeta]);

  useTitleBar({
    title: (cityText as { "city.title"?: string } | null)?.["city.title"] ?? city,
    progress: null,
    backPath: `/${project}`,
  });

  if (cityLoading || routesLoading)
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        Loading…
      </div>
    );
  if (!routesText)
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        City not found.
      </div>
    );

  return (
    <div className="city-page">
      {logoUrl ? <img src={logoUrl} alt="" className="city-page__logo" /> : null}
      {cityText ? (
        <div className="city-page__intro">
          <h1 className="city-page__title">
            {(cityText as { "city.title"?: string })["city.title"]}
          </h1>
          <MarkdownText
            text={(cityText as { "city.description"?: string })["city.description"]}
            style={{
              fontSize: 14,
              color: theme.textSecondary,
              marginTop: 8,
              lineHeight: 1.6,
            }}
          />
        </div>
      ) : null}
      <h2 className="city-page__subtitle">Choose a route</h2>
      {Object.entries(routesText).map(([routeId, route]) => (
        <RouteSelector
          key={routeId}
          project={project!}
          city={city!}
          routeId={routeId}
          route={route}
        />
      ))}
    </div>
  );
}