import { useState, useEffect, useContext } from 'react'
import { LanguageContext } from '../i18n/LanguageContext'

const modules = import.meta.glob('../data/text/**/*.yaml')

export function useText(path) {
  const { currentLang } = useContext(LanguageContext)
  const [text, setText] = useState(() => {
    const key = `../data/text/${currentLang}/${path}.yaml`
    const loader = modules[key]
    return loader ? null : null
  })
  const [loading, setLoading] = useState(() => {
    const key = `../data/text/${currentLang}/${path}.yaml`
    const loader = modules[key]
    return loader ? true : false
  })

  useEffect(() => {
    const key = `../data/text/${currentLang}/${path}.yaml`
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
