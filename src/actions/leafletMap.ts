import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export interface LeafletMapParams {
  center: [number, number];
  zoom: number;
}

const PIN = leaflet.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;background:#BF0A30;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconAnchor: [7, 7],
});

export function leafletMap(node: HTMLElement, params: LeafletMapParams) {
  const map = leaflet.map(node, { zoomControl: false, scrollWheelZoom: false });
  map.setView(params.center, params.zoom);

  leaflet
    .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
    .addTo(map);

  const marker = leaflet
    .marker(params.center, {
      icon: PIN as unknown as leaflet.Icon,
    })
    .addTo(map);

  return {
    update(newParams: LeafletMapParams) {
      map.setView(newParams.center, newParams.zoom);
      marker.setLatLng(newParams.center);
    },
    destroy() {
      map.remove();
    },
  };
}
