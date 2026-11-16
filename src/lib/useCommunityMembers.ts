import { useEffect, useState } from 'react'
import { communityMembers, type CommunityMember } from '../data/mockData'
import { getCommunityProfiles } from './profile'
import { supabase } from './supabase'

// Real members only. The demo members are used only in the local demo
// (no Supabase), so real users never see made-up people.
export function useCommunityMembers() {
  const [members, setMembers] = useState<CommunityMember[]>(supabase ? [] : communityMembers)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    let active = true
    getCommunityProfiles()
      .then((profiles) => {
        if (active) setMembers(profiles)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load community profiles.')
      })
      .finally(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  return { members, error, loaded }
}
