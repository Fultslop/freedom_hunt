import { useState, useEffect, useContext } from 'react'
import { LanguageContext } from '../i18n/LanguageContext'

const modules = import.meta.glob('../data/text/**/*.json')

export function useText(path) {
  const { currentLang } = useContext(LanguageContext)
  const [text, setText] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const key = `../data/text/${currentLang}/${path}.json`
    const loader = modules[key]
    if (!loader) {
      setText(null)
      setLoading(false)
      return
    }
    setLoading(true)
    loader()
      .then(mod => {
        setText(mod.default)
        setLoading(false)
      })
      .catch(() => {
        setText(null)
        setLoading(false)
      })
  }, [currentLang, path])

  return { text, loading }
}
