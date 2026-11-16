import { useEffect, useState } from 'react'
import { getCurrentModerationRole } from './moderation'
import { supabase } from './supabase'

// The one premium (Supporter) switch for the whole app. Every Supporter
// feature checks usePremium(). For now only admins and moderators have it
// (see has_premium() in the database); later paying members get it too.

let cached: Promise<boolean> | null = null

async function loadPremium(): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('has_premium')
  if (!error) return data === true
  // Database not updated yet: fall back to the staff role.
  const role = await getCurrentModerationRole()
  return role === 'admin' || role === 'moderator'
}

export function getPremium(): Promise<boolean> {
  if (!cached) cached = loadPremium().catch(() => false)
  return cached
}

// Check the switch again after login, logout or a switch of account.
supabase?.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') cached = null
})

export function usePremium(): boolean {
  const [premium, setPremium] = useState(false)
  useEffect(() => {
    let active = true
    void getPremium().then((value) => {
      if (active) setPremium(value)
    })
    return () => {
      active = false
    }
  }, [])
  return premium
}
