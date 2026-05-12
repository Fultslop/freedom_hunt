import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { leafletMap } from "../actions/leafletMap";
import type { LeafletMapParams } from "../actions/leafletMap";
import CoordinatePicker from "../components/CoordinatePicker.svelte";

const mockActionReturn = { update: vi.fn(), destroy: vi.fn() };
vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => mockActionReturn),
}));

beforeEach(() => {
  vi.mocked(leafletMap).mockClear();
});

test("renders latitude and longitude inputs with initial values", () => {
  render(CoordinatePicker, {
    props: {
      value: { latitude: 52.0799, longitude: 4.3133 },
      onchange: vi.fn(),
    },
  });
  expect((screen.getByLabelText(/latitude/i) as HTMLInputElement).value).toBe("52.0799");
  expect((screen.getByLabelText(/longitude/i) as HTMLInputElement).value).toBe("4.3133");
});

test("manual latitude change fires onchange with updated coords", async () => {
  const onchange = vi.fn();
  render(CoordinatePicker, {
    props: { value: { latitude: 52.0799, longitude: 4.3133 }, onchange },
  });
  await fireEvent.input(screen.getByLabelText(/latitude/i), {
    target: { value: "51.5" },
  });
  expect(onchange).toHaveBeenCalledWith({ latitude: 51.5, longitude: 4.3133 });
});

test("manual longitude change fires onchange with updated coords", async () => {
  const onchange = vi.fn();
  render(CoordinatePicker, {
    props: { value: { latitude: 52.0799, longitude: 4.3133 }, onchange },
  });
  await fireEvent.input(screen.getByLabelText(/longitude/i), {
    target: { value: "5.0" },
  });
  expect(onchange).toHaveBeenCalledWith({ latitude: 52.0799, longitude: 5 });
});

test("map click fires onchange with clicked coordinates", async () => {
  const onchange = vi.fn();
  render(CoordinatePicker, {
    props: { value: { latitude: 52.0799, longitude: 4.3133 }, onchange },
  });
  await vi.waitFor(() => {
    expect(vi.mocked(leafletMap).mock.calls.length).toBeGreaterThan(0);
  });
  const actionParams = vi.mocked(leafletMap).mock.calls[0][1] as LeafletMapParams;
  actionParams.onClick!(53.0, 5.0);
  expect(onchange).toHaveBeenCalledWith({ latitude: 53.0, longitude: 5.0 });
});
