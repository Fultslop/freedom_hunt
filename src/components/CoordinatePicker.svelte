<script lang="ts">
  import { leafletMap as defaultMapAction } from "../actions/leafletMap";
  import "./CoordinatePicker.css";

  let {
    value = { latitude: 0, longitude: 0 },
    onchange,
    mapAction = defaultMapAction,
  }: {
    value?: { latitude: number; longitude: number };
    onchange: (coords: { latitude: number; longitude: number }) => void;
    mapAction?: typeof defaultMapAction;
  } = $props();

  const center = $derived<[number, number]>([value.latitude, value.longitude]);
</script>

<div class="coord-picker">
  <div class="coord-picker__inputs">
    <div class="coord-picker__field">
      <label class="coord-picker__label" for="cp-latitude">Latitude</label>
      <input
        id="cp-latitude"
        type="number"
        step="any"
        class="coord-picker__input"
        value={value.latitude}
        oninput={(e) => {
          const lat = parseFloat((e.target as HTMLInputElement).value);
          onchange({ latitude: isNaN(lat) ? value.latitude : lat, longitude: value.longitude });
        }}
      />
    </div>
    <div class="coord-picker__field">
      <label class="coord-picker__label" for="cp-longitude">Longitude</label>
      <input
        id="cp-longitude"
        type="number"
        step="any"
        class="coord-picker__input"
        value={value.longitude}
        oninput={(e) => {
          const lng = parseFloat((e.target as HTMLInputElement).value);
          onchange({ latitude: value.latitude, longitude: isNaN(lng) ? value.longitude : lng });
        }}
      />
    </div>
  </div>
  <div
    class="coord-picker__map"
    use:mapAction={{
      center,
      zoom: 15,
      scrollWheelZoom: true,
      onClick: (lat, lng) => onchange({ latitude: lat, longitude: lng }),
    }}
  ></div>
</div>
