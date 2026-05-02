import { useState, useEffect, useContext } from 'react'
import { LanguageContext } from '../i18n/LanguageContext'

const modules = import.meta.glob('../data/text/**/*.yaml')

export function useLocations(paths) {
  const { currentLang } = useContext(LanguageContext)
  const [locations, setLocations] = useState(() => (!paths || paths.length === 0) ? [] : [])
  const [loading, setLoading] = useState(() => (!paths || paths.length === 0) ? false : true)

  useEffect(() => {
    if (!paths || paths.length === 0) {
      setLocations([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(
      paths.map(path => {
        const key = `../data/text/${currentLang}/${path}.yaml`
        const loader = modules[key]
        return loader ? loader().then(m => m.default) : Promise.resolve(null)
      })
    )
      .then(results => {
        setLocations(results.filter(Boolean))
        setLoading(false)
      })
      .catch(() => {
        setLocations([])
        setLoading(false)
      })
  }, [currentLang, JSON.stringify(paths)])

  return { locations, loading }
}
