import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useText } from "../hooks/useText";
import { useTheme } from "../theme/ThemeContext";
import { useTitleBar } from "../theme/TitleBarContext";
import { fetchImage } from "../assets/AssetManager";
import CitySelector from "../components/CitySelector";
import MarkdownText from "../components/MarkdownText";
import type { CitiesText } from "../types/data";
import type { ThemeName } from "../types/theme";
import "./ProjectPage.css";

export default function ProjectPage() {
  const { project } = useParams<{ project: string }>();
  const { text: projectMeta } = useText(`projects/${project}/${project}`);
  const { text: citiesText, loading: citiesLoading } =
    useText<CitiesText>(`projects/${project}/cities`);
  const { theme, setThemeName } = useTheme();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (projectMeta) setThemeName(((projectMeta as { style?: string }).style ?? "app") as ThemeName);
  }, [projectMeta, setThemeName]);

  useEffect(() => {
    if (projectMeta && typeof projectMeta === "object" && "project.image" in projectMeta) {
      const meta = projectMeta as { "project.image"?: string };
      if (meta["project.image"]) {
        fetchImage(meta["project.image"]).then(setLogoUrl);
      }
    }
  }, [projectMeta]);

  useTitleBar({
    title: (citiesText?.["page.title"] as string | undefined) ?? project,
    progress: null,
    backPath: "/",
  });

  if (citiesLoading)
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        Loading…
      </div>
    );
  if (!citiesText)
    return (
      <div
        style={{ padding: 24, background: theme.background, color: theme.text }}
      >
        Project not found.
      </div>
    );

  return (
    <div className="project-page">
      {logoUrl ? <img src={logoUrl} alt="" className="project-page__logo" /> : null}
      <h1 className="project-page__title">{citiesText["page.title"] as string}</h1>
      <MarkdownText text={citiesText["page.text"] as string | undefined} />
      <h2 className="project-page__select-city">
        {citiesText["page.selectCity"] as string}
      </h2>
      <div className="project-page__city-list">
        {citiesText.items.map((city) => (
          <CitySelector key={city.id} project={project!} city={city} />
        ))}
      </div>
    </div>
  );
}