import { createContext, useState, useContext, useEffect } from "react";

export interface TitleBarState {
  title?: string;
  progress?: { current: number; total: number } | null;
  backPath?: string | null;
}

interface TitleBarContextValue {
  titleBar: TitleBarState;
  setTitleBar: React.Dispatch<React.SetStateAction<TitleBarState>>;
}

const DEFAULT_TITLE_BAR: TitleBarState = {
  title: "Freedom Hunt",
  progress: null,
  backPath: null,
};

export const TitleBarContext = createContext<TitleBarContextValue | null>(null);

export function TitleBarProvider({ children }: { children: React.ReactNode }) {
  const [titleBar, setTitleBar] = useState<TitleBarState>(DEFAULT_TITLE_BAR);
  return (
    <TitleBarContext.Provider value={{ titleBar, setTitleBar }}>
      {children}
    </TitleBarContext.Provider>
  );
}

export function useTitleBar(config?: TitleBarState): TitleBarContextValue {
  const ctx = useContext(TitleBarContext);
  if (!ctx) throw new Error("useTitleBar must be used inside TitleBarProvider");
  useEffect(() => {
    if (config !== undefined) ctx.setTitleBar(config);
  }, [JSON.stringify(config)]); // eslint-disable-line react-hooks/exhaustive-deps
  return ctx;
}