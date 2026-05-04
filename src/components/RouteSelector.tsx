import { useNavigate } from "react-router-dom";
import type { RouteDefinition } from "../types/data";
import "./RouteSelector.css";

interface RouteSelectorProps {
  project: string;
  city: string;
  routeId: string;
  route: RouteDefinition;
}

export default function RouteSelector({
  project,
  city,
  routeId,
  route,
}: RouteSelectorProps) {
  const navigate = useNavigate();
  const handleNav = () => navigate(`/${project}/${city}/${routeId}`);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleNav()}
      className="route-card"
    >
      <div className="route-card__name">{routeId.replace(/_/g, " ")}</div>
      <div className="route-card__description">{route.description}</div>
      <div className="route-card__stops">
        {route.locations.length} stop{route.locations.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}