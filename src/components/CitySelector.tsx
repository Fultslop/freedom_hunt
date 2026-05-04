import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchImage } from "../assets/AssetManager";
import type { City } from "../types/data";
import "./CitySelector.css";

interface CitySelectorProps {
  project: string;
  city: City;
}

export default function CitySelector({ project, city }: CitySelectorProps) {
  const navigate = useNavigate();
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!city.image) return;
    let cancelled = false;
    fetchImage(city.image).then((url) => {
      if (!cancelled) setImageSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [city.image]);

  const handleNav = () => navigate(`/${project}/${city.id}`);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleNav()}
      className="city-card"
    >
      {imageSrc ? (
        <img src={imageSrc} alt={city.name} className="city-card__image" />
      ) : null}
      <div>
        <div className="city-card__name">{city.name}</div>
        <div className="city-card__country">{city.country}</div>
        {city.description ? (
          <div className="city-card__description">{city.description}</div>
        ) : null}
      </div>
    </div>
  );
}