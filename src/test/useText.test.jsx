import { renderHook, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../i18n/LanguageContext";
import { useText } from "../hooks/useText";

const wrapper = ({ children }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

test("loads text for given path", async () => {
  const { result } = renderHook(() => useText("test_fixture"), { wrapper });
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.text).toEqual({ hello: "world" });
});

test("returns null text for missing path", async () => {
  const { result } = renderHook(() => useText("does_not_exist"), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.text).toBeNull();
});
