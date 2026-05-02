const PREFIX = 'editor_pending_'

export function getPending(project, city) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${project}_${city}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addPending(project, city, entry) {
  const current = getPending(project, city)
  const without = current.filter(e => e.filename !== entry.filename)
  localStorage.setItem(`${PREFIX}${project}_${city}`, JSON.stringify([...without, entry]))
}

export function removePending(project, city, filename) {
  const current = getPending(project, city)
  localStorage.setItem(
    `${PREFIX}${project}_${city}`,
    JSON.stringify(current.filter(e => e.filename !== filename))
  )
}
