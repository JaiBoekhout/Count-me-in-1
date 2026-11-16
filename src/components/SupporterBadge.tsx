import { Beer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePremium } from '../lib/premium'
import { supabase } from '../lib/supabase'

// "Supporter" badge: members with Pro (bought, or earned with the invite
// challenge). On your own profile it also shows while Pro is only switched on
// for the team, so admins and moderators can see what it looks like.
export function SupporterBadge({ profileId, isOwnProfile }: { profileId: string | null | undefined; isOwnProfile: boolean }) {
  const ownPremium = usePremium()
  const [isSupporter, setIsSupporter] = useState(false)

  useEffect(() => {
    if (isOwnProfile || !profileId || !supabase) return
    let active = true
    void Promise.resolve(supabase.rpc('supporter_ids', { member_ids: [profileId] }))
      .then(({ data, error }) => {
        if (active && !error) setIsSupporter(Array.isArray(data) && data.length > 0)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [profileId, isOwnProfile])

  if (!(isOwnProfile ? ownPremium : isSupporter)) return null
  return (
    <span className="supporter-badge" title="Supporter: shouted the app a beer">
      <Beer aria-hidden="true" />
      Supporter
    </span>
  )
}
