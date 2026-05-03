import { createContext, useState, useContext, useEffect } from "react";

const DEFAULT_TITLE_BAR = {
  title: "Freedom Hunt",
  progress: null,
  backPath: null,
};

export const TitleBarContext = createContext(null);

export function TitleBarProvider({ children }) {
  const [titleBar, setTitleBar] = useState(DEFAULT_TITLE_BAR);
  return (
    <TitleBarContext.Provider value={{ titleBar, setTitleBar }}>
      {children}
    </TitleBarContext.Provider>
  );
}

export function useTitleBar(config) {
  const ctx = useContext(TitleBarContext);
  useEffect(() => {
    if (config !== undefined) ctx.setTitleBar(config);
  }, [JSON.stringify(config)]); // eslint-disable-line react-hooks/exhaustive-deps
  return ctx;
}
