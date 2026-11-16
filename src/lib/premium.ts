import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// The premium switch. Right now only admins and moderators are premium, so new
// Supporter features can be tested before members see them. Later the
// database function has_premium() also returns true for paying Supporters;
// nothing in the app needs to change for that.

let cached: Promise<boolean> | null = null
let cachedFor: string | null = null

export async function hasPremium(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id ?? null
  if (!userId) return false
  if (cached && cachedFor === userId) return cached
  cachedFor = userId
  cached = Promise.resolve(supabase.rpc('has_premium'))
    .then(({ data: result, error }) => !error && result === true)
    .catch(() => false)
  return cached
}

export function usePremium() {
  const [premium, setPremium] = useState(false)
  useEffect(() => {
    let active = true
    void hasPremium().then((result) => { if (active) setPremium(result) })
    return () => { active = false }
  }, [])
  return premium
}
