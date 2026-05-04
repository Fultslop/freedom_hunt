import { createContext, useState } from "react";
import PropTypes from "prop-types";

export const LanguageContext = createContext({
  currentLang: "en",
  setLang: () => {},
});

export function LanguageProvider({ children }) {
  const [currentLang, setLang] = useState("en");
  return (
    <LanguageContext.Provider value={{ currentLang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

LanguageProvider.propTypes = {
  children: PropTypes.node,
};
