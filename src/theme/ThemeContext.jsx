import { createContext, useState, useContext } from 'react'
import { themes, DEFAULT_THEME } from './themes'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(DEFAULT_THEME)
  const theme = themes[themeName] ?? themes[DEFAULT_THEME]
  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
