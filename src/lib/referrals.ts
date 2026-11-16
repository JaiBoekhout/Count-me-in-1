import { supabase } from './supabase'

// Invite challenge: your personal invite link carries ?ref=<your id>. Whoever
// opens it and signs up is counted for you. 4 mates = 1 year of Pro free.

const storageKey = 'count-me-in-referrer-v1'
export const referralGoal = 4

// Run once when the app opens: remember who sent the link.
export function captureReferrer() {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref && /^[0-9a-f-]{36}$/i.test(ref)) window.localStorage.setItem(storageKey, ref)
  } catch {
    // Storage blocked: the invite just does not count.
  }
}

// After onboarding: tell the database who invited you (once).
export async function claimStoredReferral() {
  if (!supabase) return
  let ref: string | null = null
  try {
    ref = window.localStorage.getItem(storageKey)
  } catch {
    return
  }
  if (!ref) return
  const { error } = await supabase.rpc('claim_referral', { referrer_id: ref })
  if (!error) {
    try { window.localStorage.removeItem(storageKey) } catch { /* nothing */ }
  }
}

export type ReferralProgress = { mates: number; proUntil: string | null }

export async function getReferralProgress(): Promise<ReferralProgress | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('my_referral_progress')
  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as { mates: number; pro_until: string | null } | undefined
  return row ? { mates: row.mates ?? 0, proUntil: row.pro_until } : { mates: 0, proUntil: null }
}
