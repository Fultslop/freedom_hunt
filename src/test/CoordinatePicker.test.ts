import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import type { LeafletMapParams } from "../actions/leafletMap";
import CoordinatePicker from "../components/CoordinatePicker.svelte";

const mockMapAction = vi.fn((_node: HTMLElement, _params: LeafletMapParams) => ({
  update: vi.fn(),
  destroy: vi.fn(),
}));

beforeEach(() => {
  mockMapAction.mockClear();
  mockMapAction.mockReturnValue({ update: vi.fn(), destroy: vi.fn() });
});

test("renders latitude and longitude inputs with initial values", () => {
  render(CoordinatePicker, {
    props: {
      value: { latitude: 52.0799, longitude: 4.3133 },
      onchange: vi.fn(),
      mapAction: mockMapAction,
    },
  });
  expect((screen.getByLabelText(/latitude/i) as HTMLInputElement).value).toBe("52.0799");
  expect((screen.getByLabelText(/longitude/i) as HTMLInputElement).value).toBe("4.3133");
});

test("manual latitude change fires onchange with updated coords", async () => {
  const onchange = vi.fn();
  render(CoordinatePicker, {
    props: { value: { latitude: 52.0799, longitude: 4.3133 }, onchange, mapAction: mockMapAction },
  });
  await fireEvent.input(screen.getByLabelText(/latitude/i), {
    target: { value: "51.5" },
  });
  expect(onchange).toHaveBeenCalledWith({ latitude: 51.5, longitude: 4.3133 });
});

test("manual longitude change fires onchange with updated coords", async () => {
  const onchange = vi.fn();
  render(CoordinatePicker, {
    props: { value: { latitude: 52.0799, longitude: 4.3133 }, onchange, mapAction: mockMapAction },
  });
  await fireEvent.input(screen.getByLabelText(/longitude/i), {
    target: { value: "5.0" },
  });
  expect(onchange).toHaveBeenCalledWith({ latitude: 52.0799, longitude: 5 });
});

test("map click fires onchange with clicked coordinates", () => {
  const onchange = vi.fn();
  render(CoordinatePicker, {
    props: { value: { latitude: 52.0799, longitude: 4.3133 }, onchange, mapAction: mockMapAction },
  });
  const actionParams = mockMapAction.mock.calls[0][1] as LeafletMapParams;
  actionParams.onClick!(53.0, 5.0);
  expect(onchange).toHaveBeenCalledWith({ latitude: 53.0, longitude: 5.0 });
});
