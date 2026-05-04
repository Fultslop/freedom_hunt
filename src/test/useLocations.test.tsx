import { renderHook, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../i18n/LanguageContext";
import { useLocations } from "../hooks/useLocations";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

test("loads multiple text files in order", async () => {
  const { result } = renderHook(
    () => useLocations(["test_fixture", "test_fixture"]),
    { wrapper },
  );
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.locations).toHaveLength(2);
  expect(result.current.locations[0]).toEqual({ hello: "world" });
});

test("returns empty array and loading false for empty paths", async () => {
  const { result } = renderHook(() => useLocations([]), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.locations).toEqual([]);
});
