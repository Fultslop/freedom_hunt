// src/hooks/useCssVars.js
import { useEffect } from 'react'
import { useTheme } from '../theme/ThemeContext'

function toKebab(key) {
  return key.replace(/([A-Z])/g, '-$1').toLowerCase()
}

export function useCssVars() {
  const { theme, themeName } = useTheme()
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = themeName
    Object.entries(theme).forEach(([key, value]) => {
      if (key === 'fontFamily') {
        root.style.setProperty('--font-family', value)
      } else {
        root.style.setProperty(`--color-${toKebab(key)}`, value)
      }
    })
  }, [theme, themeName])
}
