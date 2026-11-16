import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Who may see the app: signed-in members who finished onboarding.
// - Not signed in: welcome slides (first visit) or the login screen.
// - Signed in but onboarding not finished: back to onboarding, where you left off.
// Without Supabase (local demo) everything stays open.

export type AuthGateState = 'checking' | 'signedOut' | 'needsOnboarding' | 'ready'

const returnKey = 'count-me-in-after-login'

// Remember a link someone opened before logging in (e.g. a shared activity).
export function rememberReturnPath(path: string) {
  try {
    if (path && path !== '/') window.sessionStorage.setItem(returnKey, path)
  } catch {
    // Storage blocked: you just land on Home after login.
  }
}

export function takeReturnPath() {
  try {
    const path = window.sessionStorage.getItem(returnKey)
    window.sessionStorage.removeItem(returnKey)
    return path && path.startsWith('/') ? path : null
  } catch {
    return null
  }
}

async function stateForSession(userId: string | null): Promise<AuthGateState> {
  if (!supabase || !userId) return 'signedOut'
  const { data, error } = await supabase.from('profiles').select('onboarding_complete').eq('id', userId).maybeSingle()
  // On a network error, let the member in; screens show their own errors.
  if (error) return 'ready'
  return data?.onboarding_complete ? 'ready' : 'needsOnboarding'
}

let shared: AuthGateState = supabase ? 'checking' : 'ready'
const listeners = new Set<(state: AuthGateState) => void>()
function publish(next: AuthGateState) {
  shared = next
  listeners.forEach((listener) => listener(next))
}

let started = false
function start() {
  if (started || !supabase) return
  started = true
  void supabase.auth.getSession().then(async ({ data }) => publish(await stateForSession(data.session?.user.id ?? null)))
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return
    void stateForSession(session?.user.id ?? null).then(publish)
  })
}

// Call after finishing onboarding so the gate lets you in straight away.
export function markOnboardingComplete() {
  publish('ready')
}

export function useAuthGate() {
  const [state, setState] = useState(shared)
  useEffect(() => {
    start()
    listeners.add(setState)
    setState(shared)
    return () => { listeners.delete(setState) }
  }, [])
  return state
}
