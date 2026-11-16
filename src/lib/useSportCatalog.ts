import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { registerSportIcons, sportNames } from '../data/sports'

// The same sports as on Edit my sports (the sports table in Supabase, including
// sports an admin added in the app) plus data/sports.ts. Until it loads, or
// when offline, the list from data/sports.ts is used.
export const builtInSports: string[] = sportNames

let cachedCatalog: string[] | null = null
let loading: Promise<string[]> | null = null
const listeners = new Set<(sports: string[]) => void>()

function load(force = false) {
  if (!supabase) return Promise.resolve(builtInSports)
  if (loading && !force) return loading
  loading = Promise.resolve(supabase.from('sports').select('name, icon').order('name'))
    .then(({ data, error }) => {
      if (error || !data?.length) return cachedCatalog ?? builtInSports
      registerSportIcons(data as Array<{ name: string; icon: string | null }>)
      cachedCatalog = [...new Set([...data.map((row: { name: string }) => row.name), ...sportNames])]
        .sort((left, right) => left.localeCompare(right))
      listeners.forEach((listener) => listener(cachedCatalog as string[]))
      return cachedCatalog
    })
  return loading
}

// After an admin added a sport: load the list again everywhere.
export function refreshSportCatalog() {
  return load(true)
}

export function useSportCatalog() {
  const [sports, setSports] = useState<string[]>(() => cachedCatalog ?? builtInSports)
  useEffect(() => {
    listeners.add(setSports)
    void load()
    return () => {
      listeners.delete(setSports)
    }
  }, [])
  return sports
}
