import { createContext, useState, useContext } from "react";
import PropTypes from "prop-types";
import { themes, DEFAULT_THEME } from "./themes";

const ThemeContext = createContext(null);

const STORAGE_KEY = "themeName";

export function ThemeProvider({ children }) {
  const [themeName, setThemeNameState] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME,
  );
  const theme = themes[themeName] ?? themes[DEFAULT_THEME];

  function setThemeName(name) {
    localStorage.setItem(STORAGE_KEY, name);
    setThemeNameState(name);
  }

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

ThemeProvider.propTypes = {
  children: PropTypes.node,
};

export function useTheme() {
  return useContext(ThemeContext);
}

ThemeProvider.propTypes = {
  children: PropTypes.node,
};
