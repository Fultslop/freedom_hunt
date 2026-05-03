import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useTitleBar } from "../../theme/TitleBarContext";
import "./EditorPage.css";

export default function EditorPage() {
  const { activeAuth } = useAuth();
  useTitleBar({ title: "Editor", progress: null, backPath: null });

  const project = activeAuth?.projectId ?? "democrats_abroad";

  return (
    <div className="editor-page">
      <h1 className="editor-page__title">Organiser tools</h1>
      <p className="editor-page__subtitle">{project.replace(/_/g, " ")}</p>

      <div className="editor-page__tiles">
        <div className="editor-page__tile editor-page__tile--disabled">
          <div className="editor-page__tile-name">Cities</div>
          <div className="editor-page__tile-desc">Add or edit city entries</div>
          <span className="editor-page__tile-tag">Coming soon</span>
        </div>

        <div className="editor-page__tile editor-page__tile--disabled">
          <div className="editor-page__tile-name">Routes</div>
          <div className="editor-page__tile-desc">
            Define which locations belong to each route
          </div>
          <span className="editor-page__tile-tag">Coming soon</span>
        </div>

        <Link
          to={`/editor/locations/${project}/den_haag`}
          className="editor-page__tile"
        >
          <div className="editor-page__tile-name">Locations</div>
          <div className="editor-page__tile-desc">
            Add, edit, or hide individual hunt locations
          </div>
        </Link>
      </div>
    </div>
  );
}
